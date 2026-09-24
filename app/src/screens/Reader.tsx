// Label reader: photograph a label, menu or sign, read its text on the device, and ask the model about it
// (ADR 0024).
import { useEffect, useRef, useState } from 'react';
import { closeCamera, openCamera } from '../engine/camera';
import { engineState, ensureLlm } from '../engine/engine';
import { aboutTextPrompt, stripStageDirections, streamAnswer } from '../engine/llm';
import { log } from '../engine/metrics';
import { mockCamera, mockFrame } from '../engine/mockCamera';
import { readText } from '../engine/ocr';
import { useT } from '../i18n';
import { goBack } from '../router';
import { Back } from '../ui/icons';
import { useTitle } from '../ui/useTitle';

const QUESTIONS = [
  'What is this, in short?',
  'Which allergens does it mention?',
  'Translate it for me.',
  'Is it vegan?',
];

// The whole video frame, for OCR: text needs every pixel it can get.
function grab(video: HTMLVideoElement): HTMLCanvasElement {
  if (engineState().mock) return mockFrame();
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d')!.drawImage(video, 0, 0);
  return c;
}

export function Reader() {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [reading, setReading] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useTitle(t('Label reader'));

  useEffect(() => {
    if (!cameraOn) return;
    const el = video.current!;
    let cancelled = false;
    (async () => {
      try {
        if (engineState().mock) mockCamera(el);
        else stream.current = await openCamera(el);
        if (cancelled) closeCamera(stream.current, el);
      } catch (e) {
        log(`Reader camera error: ${(e as Error).message}`);
        setError(t('The camera could not start. Allow it in your browser settings.'));
      }
    })();
    return () => {
      cancelled = true;
      closeCamera(stream.current, el);
      stream.current = null;
    };
  }, [cameraOn, t]);

  const capture = async () => {
    setError(null);
    const frame = grab(video.current!);
    setCameraOn(false);
    setReading(0);
    try {
      const read = await readText(frame, setReading);
      setText(read);
      if (!read) setError(t('No text found. Get closer, with good light, and try again.'));
    } catch (e) {
      setError((e as Error).message || t('The text could not be read'));
    } finally {
      setReading(null);
    }
  };

  const ask = async (q: string) => {
    if (!text.trim() || !q.trim()) return;
    setBusy(true);
    setError(null);
    setAnswer('');
    try {
      let shown = '';
      await streamAnswer(await ensureLlm(), aboutTextPrompt(text, q), d => {
        shown += d;
        setAnswer(stripStageDirections(shown));
      });
    } catch (e) {
      setAnswer(null);
      setError((e as Error).message || t('It could not answer'));
    } finally {
      setBusy(false);
    }
  };

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
        <h1>{t('Label reader')}</h1>
        <p className="lede">{t('The photo and its text stay on this device.')}</p>
      </section>

      {cameraOn ? (
        <div className="reader__camera">
          <video ref={video} playsInline muted aria-label={t('Camera view')} />
          <button className="btn btn--primary btn--block" onClick={() => void capture()}>
            {t('Read the text')}
          </button>
        </div>
      ) : reading !== null ? (
        <div className="stack" aria-live="polite">
          <span>{t('Reading… {n}%', { n: Math.round(reading * 100) })}</span>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(reading * 100)}
          >
            <span style={{ width: `${Math.round(reading * 100)}%` }} />
          </div>
        </div>
      ) : (
        <>
          <label className="field">
            <span className="field__label">{t('The text it read (you can fix it)')}</span>
            <textarea
              className="field__input"
              rows={5}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </label>
          <div className="chips chips--left">
            {QUESTIONS.map(q => (
              <button
                key={q}
                type="button"
                className="chip"
                disabled={busy || !text.trim()}
                onClick={() => void ask(t(q))}
              >
                {t(q)}
              </button>
            ))}
          </div>
          <form
            className="talk__row"
            onSubmit={e => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <label className="sr-only" htmlFor="reader-question">
              {t('Your question')}
            </label>
            <input
              id="reader-question"
              className="field__input talk__input"
              value={question}
              placeholder={t('Ask about it')}
              onChange={e => setQuestion(e.target.value)}
            />
            <button className="btn btn--primary" disabled={busy || !question.trim() || !text.trim()}>
              {t('Ask')}
            </button>
          </form>
          {answer !== null && (
            <p className="bubble bubble--it" aria-live="polite" style={{ maxWidth: '100%' }}>
              {answer || <span className="dots" aria-label={t('Thinking')} />}
            </p>
          )}
          <button
            className="btn btn--quiet"
            onClick={() => {
              setAnswer(null);
              setText('');
              setCameraOn(true);
            }}
          >
            {t('Read something else')}
          </button>
        </>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
