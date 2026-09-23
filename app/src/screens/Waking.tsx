// The wait while a thing wakes up: what was seen, the soul being written, then its hello.
import { useEffect, useState } from 'react';
import { loadSettings } from '../store/settings';
import { speak } from '../engine/voice';
import { takePendingWake, wake, type WakeInput, type WakeProgress, type WakeStep } from '../engine/wake';
import { navigate } from '../router';
import { Check, Phone } from '../ui/icons';
import { useTitle } from '../ui/useTitle';
import { useWakeLock } from '../ui/useWakeLock';

const STEPS: { step: WakeStep; title: string; detail: string }[] = [
  { step: 'look', title: 'Taking a good look', detail: 'What it is and what colour.' },
  { step: 'soul', title: 'Finding its personality', detail: 'A name, a voice, a way of seeing things.' },
  { step: 'hello', title: 'Saying hello', detail: '' },
];

export function Waking() {
  // Taken once: the capture belongs to this screen, and a reload lands back home.
  const [what] = useState<WakeInput | null>(() => takePendingWake());
  const [progress, setProgress] = useState<WakeProgress>({ step: 'look' });
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useTitle('Waking up');
  useWakeLock(!error);

  useEffect(() => {
    if (!what) {
      navigate({ name: 'home' }, { replace: true });
      return;
    }
    let cancelled = false;
    wake(what, p => !cancelled && setProgress(p))
      .then(async soul => {
        if ((await loadSettings()).speak) speak(soul.greeting, soul);
        if (!cancelled) navigate({ name: 'talk', id: soul.id }, { replace: true });
      })
      .catch((e: Error) => !cancelled && setError(e.message || 'Something went wrong'));
    return () => {
      cancelled = true;
    };
  }, [what, attempt]);

  const photo = what?.kind === 'photo' ? what.thumbnail : null;
  const current = STEPS.findIndex(s => s.step === progress.step);

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
        <h1>{error ? 'It went back to sleep' : 'Something stirs…'}</h1>
        <p className="lede">{error ? error : 'It takes about 20 seconds.'}</p>
      </section>

      {error ? (
        <div className="stack">
          <button
            className="btn btn--primary btn--block"
            onClick={() => {
              setError(null);
              setProgress({ step: 'look' });
              setAttempt(a => a + 1);
            }}
          >
            Try again
          </button>
          <button className="btn btn--quiet" onClick={() => navigate({ name: 'home' }, { replace: true })}>
            Back home
          </button>
        </div>
      ) : (
        <ol className="steps" aria-live="polite">
          {STEPS.map((s, i) => {
            const state = i < current ? 'done' : i === current ? 'now' : 'later';
            const detail = s.step === 'look' && progress.description ? progress.description : s.detail;
            return (
              <li key={s.step} className={`steps__item steps__item--${state}`}>
                <span className="steps__mark">{state === 'done' ? <Check size={16} /> : <span />}</span>
                <span className="stack" style={{ gap: 2 }}>
                  <span className="steps__title">
                    {s.title}
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
        <Phone size={16} /> Everything happens on this device
      </p>
    </main>
  );
}
