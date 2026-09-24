// Treasure hunt: one thing gives a riddle about another, and the player finds it and points the camera at it.
// The camera compares what it sees with the hidden thing's signature, so only the right thing counts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { closeCamera, cropCentre, FRAME_SHARE, framedSquare, openCamera } from '../engine/camera';
import { engineState, ensureLlm, ensureVision } from '../engine/engine';
import { riddle } from '../engine/llm';
import { log } from '../engine/metrics';
import { mockCamera, mockFrame } from '../engine/mockCamera';
import { MATCH_SAME_LABEL_AT } from '../engine/recognise';
import { similarity } from '../engine/vision';
import { speak, stopSpeaking, unlockSpeech } from '../engine/voice';
import { goBack } from '../router';
import { loadSettings } from '../store/settings';
import { useSouls, type Soul } from '../store/souls';
import { Back, Close } from '../ui/icons';
import { Portrait } from '../ui/Portrait';
import { useTitle } from '../ui/useTitle';

export const ROUNDS = 3;
const LOOK_EVERY_MS = 700;
// Two looks in a row must agree, so a passing glance does not count.
const HITS_NEEDED = 2;

type Phase =
  | { kind: 'start' }
  | { kind: 'clue'; host: Soul; target: Soul; clue: string | null; hinted: boolean }
  | { kind: 'found'; host: Soul; target: Soul; gaveUp: boolean }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

// Picks who hides and who gives the clue: the hidden thing needs a photo signature; the host is anyone else.
export function pickRound(souls: readonly Soul[], previous: readonly string[], random = Math.random) {
  const hideable = souls.filter(s => s.signature?.length);
  const fresh = hideable.filter(s => !previous.includes(s.id));
  const pool = fresh.length ? fresh : hideable;
  const target = pool[Math.floor(random() * pool.length)];
  if (!target) return null;
  const hosts = souls.filter(s => s.id !== target.id);
  const host = hosts[Math.floor(random() * hosts.length)];
  return host ? { host, target } : null;
}

export const canHunt = (souls: readonly Soul[] | null) =>
  !!souls && souls.length >= 2 && souls.some(s => s.signature?.length);

export function Hunt() {
  const souls = useSouls();
  const [phase, setPhase] = useState<Phase>({ kind: 'start' });
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [played, setPlayed] = useState<string[]>([]);
  useTitle('Treasure hunt');

  useEffect(() => () => stopSpeaking(), []);

  const say = async (text: string, who: Soul) => {
    if ((await loadSettings()).speak) speak(text, who);
  };

  const nextRound = async () => {
    unlockSpeech();
    stopSpeaking();
    const pick = souls ? pickRound(souls, played) : null;
    if (!pick) return setPhase({ kind: 'error', message: 'Wake at least two things, one with the camera.' });
    setPhase({ kind: 'clue', ...pick, clue: null, hinted: false });
    setPlayed(p => [...p, pick.target.id]);
    setRound(r => r + 1);
    try {
      const clue = await riddle(await ensureLlm(), pick.host, pick.target);
      setPhase(p => (p.kind === 'clue' && p.target.id === pick.target.id ? { ...p, clue } : p));
      void say(clue, pick.host);
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message || 'The clue got lost' });
    }
  };

  const hint = async () => {
    if (phase.kind !== 'clue' || phase.hinted) return;
    const { host, target } = phase;
    setPhase({ ...phase, hinted: true });
    try {
      const clue = await riddle(await ensureLlm(), host, target, true);
      setPhase(p => (p.kind === 'clue' && p.target.id === target.id ? { ...p, clue } : p));
      void say(clue, host);
    } catch (e) {
      log(`Hint failed: ${(e as Error).message}`);
    }
  };

  const found = useCallback(
    (gaveUp: boolean) => {
      if (phase.kind !== 'clue') return;
      stopSpeaking();
      if (!gaveUp) setScore(s => s + 1);
      setPhase({ kind: 'found', host: phase.host, target: phase.target, gaveUp });
      void say(
        gaveUp ? `It was me, ${phase.target.name}!` : `You found me! I'm ${phase.target.name}!`,
        phase.target,
      );
    },
    [phase],
  );

  const header = (
    <header className="bar">
      <button className="icon-btn icon-btn--bare" aria-label="Back" onClick={() => goBack({ name: 'home' })}>
        <Back />
      </button>
      {round > 0 && (
        <span className="pill" aria-live="polite">
          Round {Math.min(round, ROUNDS)} of {ROUNDS} · {score} found
        </span>
      )}
    </header>
  );

  if (phase.kind === 'clue' && phase.clue) {
    return (
      <Seek
        phase={phase}
        onFound={() => found(false)}
        onGiveUp={() => found(true)}
        onHint={() => void hint()}
      />
    );
  }

  return (
    <main className="screen hunt">
      {header}
      {phase.kind === 'start' && (
        <>
          <section className="stack" style={{ gap: 8 }}>
            <h1>Treasure hunt</h1>
            <p className="lede">
              One of your things hides, another gives you a riddle. Find the hidden thing and point your
              camera at it. {ROUNDS} rounds.
            </p>
          </section>
          <div className="spacer" />
          <button
            className="btn btn--primary btn--block"
            disabled={!canHunt(souls)}
            onClick={() => void nextRound()}
          >
            {canHunt(souls) ? 'Start the hunt' : 'Wake two things first, one with the camera'}
          </button>
        </>
      )}
      {phase.kind === 'clue' && (
        <section className="hunt__center" aria-live="polite">
          <Portrait soul={phase.host} size={120} ring={3} />
          <h1>{phase.host.name} is thinking of a riddle…</h1>
        </section>
      )}
      {phase.kind === 'found' && (
        <>
          <section className="hunt__center" aria-live="polite">
            <Portrait soul={phase.target} size={150} ring={4} />
            <h1>{phase.gaveUp ? `It was ${phase.target.name}!` : `You found ${phase.target.name}!`}</h1>
            <p className="lede">{phase.target.title}</p>
          </section>
          <div className="spacer" />
          <button
            className="btn btn--primary btn--block"
            onClick={() => (round >= ROUNDS ? setPhase({ kind: 'done' }) : void nextRound())}
          >
            {round >= ROUNDS ? 'See the score' : 'Next riddle'}
          </button>
        </>
      )}
      {phase.kind === 'done' && (
        <>
          <section className="hunt__center">
            <p className="hunt__score">
              {score}
              <span> / {ROUNDS}</span>
            </p>
            <h1>
              {score === ROUNDS ? 'A perfect hunt!' : score > 0 ? 'Well hunted!' : 'They hid well this time.'}
            </h1>
          </section>
          <div className="spacer" />
          <button
            className="btn btn--primary btn--block"
            onClick={() => {
              setRound(0);
              setScore(0);
              setPlayed([]);
              setPhase({ kind: 'start' });
            }}
          >
            Play again
          </button>
        </>
      )}
      {phase.kind === 'error' && (
        <p className="notice notice--error" role="alert">
          {phase.message}
        </p>
      )}
    </main>
  );
}

// The seeking view: the riddle over the camera, checking a few times a second for the hidden thing.
function Seek({
  phase,
  onFound,
  onGiveUp,
  onHint,
}: {
  phase: Extract<Phase, { kind: 'clue' }>;
  onFound: () => void;
  onGiveUp: () => void;
  onHint: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const target = phase.target.signature ?? [];

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    let hits = 0;
    const el = video.current!;
    const mock = engineState().mock;
    (async () => {
      try {
        if (mock) mockCamera(el);
        else stream = await openCamera(el);
        if (cancelled) return closeCamera(stream, el);
        const vision = await ensureVision();
        timer = setInterval(() => {
          if (!mock && !el.videoWidth) return;
          const crop = mock
            ? cropCentre(mockFrame(), 224)
            : cropCentre(el, 224, framedSquare(el, frameRef.current));
          const score = similarity(vision.embed(crop), target);
          hits = score >= MATCH_SAME_LABEL_AT ? hits + 1 : 0;
          if (hits >= HITS_NEEDED) {
            clearInterval(timer);
            log(`Hunt: found ${phase.target.name} at ${score.toFixed(2)}`);
            onFound();
          }
        }, LOOK_EVERY_MS);
      } catch (e) {
        log(`Hunt camera error: ${(e as Error).message}`);
        setError('The camera could not start. Allow it in your browser settings.');
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      closeCamera(stream, el);
    };
    // Only a new round restarts the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.target.id]);

  return (
    <main className="screen screen--flush wake hunt__seek">
      <video ref={video} className="wake__video" playsInline muted aria-label="Camera view" />
      <div
        ref={frameRef}
        className="wake__frame"
        style={{ width: `${FRAME_SHARE * 100}vmin` }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M1 16V6a5 5 0 0 1 5-5h10M84 1h10a5 5 0 0 1 5 5v10M99 84v10a5 5 0 0 1-5 5H84M16 99H6a5 5 0 0 1-5-5V84" />
        </svg>
      </div>
      <header className="bar wake__top">
        <button className="icon-btn wake__close" aria-label="Give up" onClick={onGiveUp}>
          <Close size={20} />
        </button>
      </header>
      <section className="wake__sheet hunt__sheet">
        <div className="hunt__clue">
          <Portrait soul={phase.host} size={44} />
          <p aria-live="polite">{phase.clue}</p>
        </div>
        {error ? (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        ) : (
          <p className="lede" style={{ fontSize: 14 }}>
            Find it and point the camera at it.
          </p>
        )}
        <div className="hunt__buttons">
          <button className="btn btn--quiet" disabled={phase.hinted} onClick={onHint}>
            {phase.hinted ? 'Hint given' : 'Give me a hint'}
          </button>
          <button className="btn btn--quiet" onClick={onGiveUp}>
            I give up
          </button>
        </div>
      </section>
    </main>
  );
}
