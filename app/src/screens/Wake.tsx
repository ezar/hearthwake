// Point the camera at a thing, frame it in the square and wake it. While framing, the classifier guesses
// what it is, a few times a second, once the LLM has loaded (the LLM always loads first: ADR 0016).
import { useEffect, useRef, useState } from 'react';
import {
  closeCamera,
  cropCentre,
  FRAME_SHARE,
  framedSquare,
  openCamera,
  thumbnailOf,
} from '../engine/camera';
import { engineState, ensureLlm, ensureVision } from '../engine/engine';
import { log } from '../engine/metrics';
import { mockCamera, mockFrame } from '../engine/mockCamera';
import { unlockSpeech } from '../engine/voice';
import { setPendingWake } from '../engine/wake';
import { goBack, navigate } from '../router';
import { Close, Flame } from '../ui/icons';
import { Link } from '../ui/Link';
import { useTitle } from '../ui/useTitle';
import { useT } from '../i18n';

const GUESS_EVERY_MS = 900;
const GUESS_MIN_SCORE = 0.2;

export function Wake() {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guess, setGuess] = useState<string | null>(null);
  useTitle(t('Wake something'));

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const el = video.current!;
    const mock = engineState().mock;
    (async () => {
      try {
        if (mock) mockCamera(el);
        else stream = await openCamera(el);
        if (cancelled) return closeCamera(stream, el);
        setReady(true);
      } catch (e) {
        const name = (e as DOMException).name;
        log(`Camera error: ${name} ${(e as Error).message}`);
        setError(
          name === 'NotAllowedError'
            ? t(
                'Hearthwake is not allowed to use the camera. Allow it in your browser settings, or describe the thing instead.',
              )
            : t('The camera could not start. Close other apps that use it, or describe the thing instead.'),
        );
        return;
      }
      try {
        await ensureLlm();
        const vision = await ensureVision();
        if (cancelled) return;
        timer = setInterval(() => {
          if (!el.videoWidth && !mock) return;
          const crop = mock
            ? cropCentre(mockFrame(), 224)
            : cropCentre(el, 224, framedSquare(el, frameRef.current));
          const top = vision.classify(crop)[0];
          setGuess(top && top.score >= GUESS_MIN_SCORE ? top.label : null);
        }, GUESS_EVERY_MS);
      } catch {
        // No live guesses; waking still works and reports its own errors.
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      closeCamera(stream, el);
    };
  }, []);

  const wakeIt = () => {
    unlockSpeech();
    const el = video.current!;
    const crop = engineState().mock
      ? cropCentre(mockFrame())
      : cropCentre(el, undefined, framedSquare(el, frameRef.current));
    setPendingWake({ kind: 'photo', crop, thumbnail: thumbnailOf(crop) });
    navigate({ name: 'waking' }, { replace: true });
  };

  return (
    <main className="screen screen--flush wake">
      <video ref={video} className="wake__video" playsInline muted aria-label={t('Camera view')} />
      <div
        ref={frameRef}
        className="wake__frame"
        style={{ width: `${FRAME_SHARE * 100}vmin` }}
        aria-hidden={!guess}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M1 16V6a5 5 0 0 1 5-5h10M84 1h10a5 5 0 0 1 5 5v10M99 84v10a5 5 0 0 1-5 5H84M16 99H6a5 5 0 0 1-5-5V84" />
        </svg>
        {guess && (
          <span className="wake__guess" aria-live="polite">
            {t('{thing}?', { thing: `${/^[aeiou]/i.test(guess) ? 'An' : 'A'} ${guess}`, label: guess })}
          </span>
        )}
      </div>

      <header className="bar wake__top">
        <button
          className="icon-btn wake__close"
          aria-label={t('Close')}
          onClick={() => goBack({ name: 'home' })}
        >
          <Close size={20} />
        </button>
        <span className="pill">
          <span className="pill__dot" style={{ background: 'var(--sage)' }} /> {t('All on this device')}
        </span>
      </header>

      <section className="wake__sheet">
        {error ? (
          <>
            <p className="notice notice--error" role="alert">
              {error}
            </p>
            <Link to={{ name: 'describe' }} className="btn btn--primary btn--block">
              {t('Describe it instead')}
            </Link>
          </>
        ) : (
          <>
            <p className="display wake__hint">{t('Frame one thing and hold still')}</p>
            <button className="wake__shutter" aria-label={t('Wake it')} onClick={wakeIt} disabled={!ready}>
              <Flame size={34} />
            </button>
            <span className="lede" style={{ fontSize: 14 }}>
              {ready ? t('Tap to wake it') : t('Opening the camera…')}
            </span>
          </>
        )}
      </section>
    </main>
  );
}
