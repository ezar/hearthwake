// The wait while a thing wakes up: what was seen, then either "Is this Flibber?" for a thing that already
// woke up, or the soul being written and its hello.
import { useEffect, useState } from 'react';
import type { Match } from '../engine/recognise';
import { speak } from '../engine/voice';
import {
  awaken,
  recognise,
  requestWelcomeBack,
  see,
  takePendingWake,
  type Seen,
  type WakeInput,
  type WakeProgress,
  type WakeStep,
} from '../engine/wake';
import { navigate } from '../router';
import { loadSettings } from '../store/settings';
import { getSoul, loadSouls } from '../store/souls';
import { Check, Phone } from '../ui/icons';
import { Portrait } from '../ui/Portrait';
import { useTitle } from '../ui/useTitle';
import { useWakeLock } from '../ui/useWakeLock';
import { useT } from '../i18n';

const STEPS: { step: WakeStep; title: string; detail: string }[] = [
  { step: 'look', title: 'Taking a good look', detail: 'What it is and what colour.' },
  { step: 'soul', title: 'Finding its personality', detail: 'A name, a voice, a way of seeing things.' },
  { step: 'hello', title: 'Saying hello', detail: '' },
];

type Phase =
  | { kind: 'working' }
  | { kind: 'ask'; seen: Seen; match: Match }
  | { kind: 'error'; message: string; seen: Seen | null };

export function Waking() {
  const t = useT();
  // Taken once: the capture belongs to this screen, and a reload lands back home.
  const [what] = useState<WakeInput | null>(() => takePendingWake());
  const [progress, setProgress] = useState<WakeProgress>({ step: 'look' });
  const [phase, setPhase] = useState<Phase>({ kind: 'working' });
  // Each run: which seen thing to continue from (after "someone new" or a retry), or null to start over.
  const [run, setRun] = useState<{ n: number; from: Seen | null }>({ n: 0, from: null });
  useTitle(t('Waking up'));
  useWakeLock(phase.kind === 'working');

  useEffect(() => {
    if (!what) {
      navigate({ name: 'home' }, { replace: true });
      return;
    }
    let cancelled = false;
    let seen: Seen | null = run.from;
    const onProgress = (p: WakeProgress) => !cancelled && setProgress(p);
    (async () => {
      if (!seen) {
        seen = await see(what);
        if (cancelled) return;
        setProgress({ step: 'look', description: seen.description });
        // Only a photo can be recognised, and only before the person has said it is someone new.
        const match = await recognise(seen, await loadSouls());
        if (cancelled) return;
        if (match) return setPhase({ kind: 'ask', seen, match });
      }
      const soul = await awaken(seen, onProgress);
      if ((await loadSettings()).speak) speak(soul.greeting, soul);
      if (!cancelled) navigate({ name: 'talk', id: soul.id }, { replace: true });
    })().catch((e: Error) => {
      if (!cancelled) setPhase({ kind: 'error', message: e.message || t('Something went wrong'), seen });
    });
    return () => {
      cancelled = true;
    };
  }, [what, run, t]);

  const photo = what?.kind === 'photo' ? what.thumbnail : null;
  const current = STEPS.findIndex(s => s.step === progress.step);

  if (phase.kind === 'ask') {
    const { soul } = phase.match;
    const known = getSoul(soul.id) ?? soul;
    return (
      <main className="screen waking">
        <div className="waking__pair" aria-hidden="true">
          <div className="waking__photo waking__photo--small">{photo && <img src={photo} alt="" />}</div>
          <Portrait soul={known} size={120} ring={3} />
        </div>
        <section className="stack" style={{ alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <h1>{t('Is this {name}?', { name: known.name })}</h1>
          <p className="lede">
            {t('It looks a lot like {who}, who woke up here before.', {
              who: known.title ? `${known.name}, ${known.title}` : known.name,
            })}
          </p>
        </section>
        <div className="spacer" />
        <div className="stack waking__actions">
          <button
            className="btn btn--primary btn--block"
            onClick={() => {
              requestWelcomeBack(known.id);
              navigate({ name: 'talk', id: known.id }, { replace: true });
            }}
          >
            {t("Yes, it's {name}", { name: known.name })}
          </button>
          <button
            className="btn btn--quiet"
            onClick={() => {
              setPhase({ kind: 'working' });
              setRun(r => ({ n: r.n + 1, from: phase.seen }));
            }}
          >
            {t("No, it's someone new")}
          </button>
        </div>
      </main>
    );
  }

  const error = phase.kind === 'error' ? phase.message : null;
  return (
    <main className="screen waking">
      <div className={`waking__rings${error ? '' : ' waking__rings--live'}`} aria-hidden="true">
        <div className="waking__ring">
          <div className="waking__photo">
            {photo ? (
              <img src={photo} alt="" />
            ) : (
              <span>{what?.kind === 'words' ? what.label[0]?.toUpperCase() : ''}</span>
            )}
          </div>
        </div>
      </div>

      <section className="stack" style={{ alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <h1>{error ? t('It went back to sleep') : t('Something stirs…')}</h1>
        <p className="lede">{error ?? t('It takes about 20 seconds.')}</p>
      </section>

      {phase.kind === 'error' ? (
        <div className="stack waking__actions">
          <button
            className="btn btn--primary btn--block"
            onClick={() => {
              setPhase({ kind: 'working' });
              setProgress({ step: phase.seen ? 'soul' : 'look', description: phase.seen?.description });
              setRun(r => ({ n: r.n + 1, from: phase.seen }));
            }}
          >
            {t('Try again')}
          </button>
          <button className="btn btn--quiet" onClick={() => navigate({ name: 'home' }, { replace: true })}>
            {t('Back home')}
          </button>
        </div>
      ) : (
        <ol className="steps" aria-live="polite">
          {STEPS.map((s, i) => {
            const state = i < current ? 'done' : i === current ? 'now' : 'later';
            const detail =
              s.step === 'look' && progress.description ? progress.description : s.detail && t(s.detail);
            return (
              <li key={s.step} className={`steps__item steps__item--${state}`}>
                <span className="steps__mark">{state === 'done' ? <Check size={16} /> : <span />}</span>
                <span className="stack" style={{ gap: 2 }}>
                  <span className="steps__title">
                    {t(s.title)}
                    <span className="sr-only">
                      {state === 'done' ? ' (done)' : state === 'now' ? ' (now)' : ''}
                    </span>
                  </span>
                  {detail && state !== 'later' && <span className="steps__detail">{detail}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="lede waking__foot">
        <Phone size={16} /> {t('Everything happens on this device')}
      </p>
    </main>
  );
}
