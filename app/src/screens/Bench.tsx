// How fast is this device? Loads the model, measures its prefill and decode speed with a fixed prompt, and times
// the vision models, then offers the result to copy or share for comparison with other devices (ADR 0024).
import { useState } from 'react';
import { engineState, ensureLlm, ensureVision, useEngine } from '../engine/engine';
import { log } from '../engine/metrics';
import { mockFrame } from '../engine/mockCamera';
import { cropCentre } from '../engine/camera';
import { useT } from '../i18n';
import { goBack } from '../router';
import { Back } from '../ui/icons';
import { APP_URL } from '../ui/shareCard';
import { useTitle } from '../ui/useTitle';
import { useWakeLock } from '../ui/useWakeLock';

export interface BenchResult {
  model: string;
  loadMs: number;
  prefill: number | null;
  decode: number | null;
  firstTokenMs: number;
  classifyMs: number;
  embedMs: number;
  device: string;
}

// "prefill: 120.5 tok/s, decode: 28.3 tok/s" → numbers.
export function parseStats(text: string): { prefill: number | null; decode: number | null } {
  const num = (name: string) => {
    const m = new RegExp(`${name}:\\s*([\\d.]+)`).exec(text);
    return m ? Number(m[1]) : null;
  };
  return { prefill: num('prefill'), decode: num('decode') };
}

// A short device name from the user agent: "iPhone · Safari", "Mac · Chrome".
export function deviceName(ua: string): string {
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Unknown';
  const browser =
    /CriOS|Chrome\//.test(ua) && !/Edg/.test(ua)
      ? 'Chrome'
      : /EdgiOS|Edg\//.test(ua)
        ? 'Edge'
        : /Firefox|FxiOS/.test(ua)
          ? 'Firefox'
          : /Safari/.test(ua)
            ? 'Safari'
            : 'Browser';
  return `${os} · ${browser}`;
}

const PROMPT = 'Tell a short, cheerful story about a kettle that learns to sing, in about eighty words.';

async function measure(): Promise<BenchResult> {
  const { device, model } = engineState();
  const loadStart = performance.now();
  const llm = await ensureLlm();
  const loadMs = performance.now() - loadStart;
  const genStart = performance.now();
  let firstTokenMs = 0;
  for await (const _ of llm.stream({
    messages: [{ role: 'user', content: PROMPT }],
    temperature: 0.7,
    max_tokens: 128,
  })) {
    if (!firstTokenMs) firstTokenMs = performance.now() - genStart;
    void _;
  }
  const { prefill, decode } = parseStats((await llm.stats?.()) ?? '');

  const vision = await ensureVision();
  const image = cropCentre(mockFrame());
  const time = (fn: () => void) => {
    const start = performance.now();
    for (let i = 0; i < 5; i++) fn();
    return (performance.now() - start) / 5;
  };
  const classifyMs = time(() => vision.classify(image));
  const embedMs = time(() => vision.embed(image));
  const result = {
    model: model.label,
    loadMs,
    prefill,
    decode,
    firstTokenMs,
    classifyMs,
    embedMs,
    device: deviceName(device?.userAgent ?? navigator.userAgent),
  };
  log(`Bench: ${JSON.stringify(result)}`);
  return result;
}

export function Bench() {
  const t = useT();
  const { llm } = useEngine();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useTitle(t('How fast is this device?'));
  useWakeLock(running);

  const run = async () => {
    setRunning(true);
    setError(null);
    setNote(null);
    try {
      setResult(await measure());
    } catch (e) {
      setError((e as Error).message || t('The benchmark stopped'));
    } finally {
      setRunning(false);
    }
  };

  const summary = result
    ? t('{device} runs {model} in the browser at {decode} tokens a second. https://{url}/', {
        device: result.device,
        model: result.model,
        decode: result.decode?.toFixed(1) ?? '?',
        url: APP_URL,
      })
    : '';

  const share = async () => {
    if (!result) return;
    const data = { text: summary };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(`${summary}\n\n${JSON.stringify(result, null, 2)}`);
        setNote(t('Copied. Paste it wherever you like.'));
      }
    } catch {
      // The share sheet was closed.
    }
  };

  const rows: [string, string][] = result
    ? [
        [t('Device'), result.device],
        [t('Model'), result.model],
        [
          t('Writing speed'),
          result.decode !== null ? t('{n} tokens/s', { n: result.decode.toFixed(1) }) : '–',
        ],
        [
          t('Reading speed'),
          result.prefill !== null ? t('{n} tokens/s', { n: result.prefill.toFixed(1) }) : '–',
        ],
        [t('First word'), t('{n} ms', { n: Math.round(result.firstTokenMs) })],
        [t('Model ready in'), t('{n} ms', { n: Math.round(result.loadMs) })],
        [t('Naming a thing'), t('{n} ms', { n: Math.round(result.classifyMs) })],
        [t('Recognising a thing'), t('{n} ms', { n: Math.round(result.embedMs) })],
      ]
    : [];

  return (
    <main className="screen">
      <header className="bar">
        <button
          className="icon-btn icon-btn--bare"
          aria-label={t('Back')}
          onClick={() => goBack({ name: 'lab' })}
        >
          <Back />
        </button>
      </header>
      <section className="stack" style={{ gap: 6 }}>
        <h1>{t('How fast is this device?')}</h1>
        <p className="lede">
          {t(
            'Runs the language model on a short story and times the vision models. It takes under a minute.',
          )}
        </p>
      </section>

      {result && (
        <>
          <p className="bench__big">
            {result.decode !== null ? result.decode.toFixed(1) : '–'}
            <span> {t('tokens/s')}</span>
          </p>
          <dl className="bench__table">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {running && llm.state === 'loading' && (
        <p className="pill" role="status">
          <span className="pill__dot" /> {t('Getting ready… {n}%', { n: Math.round(llm.progress * 100) })}
        </p>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {note && (
        <p className="notice" role="status">
          {note}
        </p>
      )}
      <div className="spacer" />
      <div className="stack" style={{ gap: 6 }}>
        <button className="btn btn--primary btn--block" disabled={running} onClick={() => void run()}>
          {running ? t('Measuring…') : result ? t('Run again') : t('Start the benchmark')}
        </button>
        {result && (
          <button className="btn btn--quiet" onClick={() => void share()}>
            {t('Share the result')}
          </button>
        )}
      </div>
    </main>
  );
}
