// Talking with a soul: hold to talk (system speech recognition) or type; replies stream in and are spoken
// sentence by sentence as they arrive.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ensureLlm, useEngine } from '../engine/engine';
import {
  compactMemory,
  needsCompaction,
  reply,
  stripStageDirections,
  WELCOME_BACK_AFTER_MS,
  welcomeBack,
} from '../engine/llm';
import { log, record } from '../engine/metrics';
import {
  canHear,
  listen,
  sentenceSplitter,
  speak,
  stopSpeaking,
  unlockSpeech,
  type Listening,
} from '../engine/voice';
import { takeWelcomeBack } from '../engine/wake';
import { goBack, navigate } from '../router';
import { loadSettings, saveSettings } from '../store/settings';
import { getSoul, saveSoul, useSouls, type ChatMessage, type Soul } from '../store/souls';
import { Back, Keyboard, Mic, Muted, Send, Speaker } from '../ui/icons';
import { Link } from '../ui/Link';
import { Portrait } from '../ui/Portrait';
import { useTitle } from '../ui/useTitle';
import { currentLang, useT } from '../i18n';

type Mode = 'voice' | 'text';
type Busy = null | 'hearing' | 'thinking' | 'remembering';

export function Talk({ id }: { id: string }) {
  const t = useT();
  const souls = useSouls();
  const soul = souls?.find(s => s.id === id) ?? null;
  const { llm, device } = useEngine();
  const hearing = !!device?.speechRecognition && canHear();
  const [mode, setMode] = useState<Mode>(hearing ? 'voice' : 'text');
  const [busy, setBusy] = useState<Busy>(null);
  const [draft, setDraft] = useState('');
  const [caption, setCaption] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const listener = useRef<Listening | null>(null);
  const releasedAt = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const [aloud, setAloud] = useState(true);
  useTitle(soul?.name ?? '');

  useEffect(() => {
    if (souls && !soul) navigate({ name: 'home' }, { replace: true });
  }, [souls, soul]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [soul?.history.length, streaming, pending, caption]);

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    void loadSettings().then(s => setAloud(s.speak));
  }, []);

  // A friend coming back is greeted with what the soul remembers: when the camera recognised the thing, or
  // after a few hours away (ADR 0021).
  const [seenAgain] = useState(() => takeWelcomeBack(id));
  const greeted = useRef(false);
  useEffect(() => {
    if (!soul || greeted.current) return;
    if (!seenAgain && Date.now() - soul.lastTalkedAt < WELCOME_BACK_AFTER_MS) return;
    greeted.current = true;
    const soulId = soul.id;
    const run = async () => {
      setBusy('thinking');
      setStreaming('');
      try {
        const [backend, settings] = await Promise.all([ensureLlm(), loadSettings()]);
        const current = getSoul(soulId);
        if (!current) return;
        const splitter = sentenceSplitter();
        const say = (sentence: string) => {
          const clean = stripStageDirections(sentence);
          if (settings.speak && clean) speak(clean, current);
        };
        let shown = '';
        const text = await welcomeBack(backend, current, seenAgain, delta => {
          shown += delta;
          setStreaming(stripStageDirections(shown));
          splitter.push(delta).forEach(say);
        });
        splitter.flush().forEach(say);
        if (text) {
          const now = Date.now();
          const history: ChatMessage[] = [...current.history, { role: 'assistant', content: text, at: now }];
          await saveSoul({ ...current, history, lastTalkedAt: now });
        }
      } catch (e) {
        log(`Welcome back failed: ${(e as Error).message}`);
      } finally {
        setStreaming(null);
        setBusy(null);
      }
    };
    void run();
  }, [soul, seenAgain]);

  if (!soul) return <main className="screen" />;

  const send = async (text: string, fromVoice: boolean) => {
    const words = text.trim();
    if (!words) return;
    setError(null);
    setPending(words);
    setBusy('thinking');
    const start = performance.now();
    const speakAloud = aloud;
    const splitter = sentenceSplitter();
    let spoke = false;
    const say = (sentence: string) => {
      // Stage directions like "(smiles)" are neither shown nor spoken.
      const clean = stripStageDirections(sentence);
      if (!speakAloud || !clean) return;
      speak(clean, soul, () => {
        if (spoke) return;
        spoke = true;
        record(
          fromVoice ? 'talk.firstAudioFromRelease' : 'talk.firstAudioFromText',
          performance.now() - (fromVoice ? releasedAt.current : start),
        );
      });
    };
    try {
      const backend = await ensureLlm();
      const current = getSoul(soul.id) ?? soul;
      setStreaming('');
      let shown = '';
      const answer = await reply(backend, current, words, delta => {
        shown += delta;
        setStreaming(stripStageDirections(shown));
        splitter.push(delta).forEach(say);
      });
      splitter.flush().forEach(say);
      const said = answer || shown.trim();
      if (!said) throw new Error(t('{name} had nothing to say. Try again.', { name: current.name }));
      const now = Date.now();
      const history: ChatMessage[] = [
        ...current.history,
        { role: 'user', content: words, at: now },
        { role: 'assistant', content: said, at: now },
      ];
      let next: Soul = { ...current, history, lastTalkedAt: now };
      await saveSoul(next);
      setStreaming(null);
      setPending(null);
      if (needsCompaction(history)) {
        setBusy('remembering');
        try {
          next = await compactMemory(backend, next);
          await saveSoul(next);
        } catch (e) {
          log(`Memory compaction failed: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      setStreaming(null);
      setPending(null);
      setDraft(words);
      setError((e as Error).message || t('It could not answer'));
    } finally {
      setBusy(null);
    }
  };

  // Push to talk. A release can be lost (for example to the permission prompt), so a tap while
  // listening also ends it.
  const startListening = () => {
    if (busy || listening) return;
    unlockSpeech();
    stopSpeaking();
    setError(null);
    setCaption('');
    try {
      listener.current = listen(setCaption);
      setListening(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stopListening = async () => {
    const l = listener.current;
    if (!l) return;
    listener.current = null;
    setListening(false);
    releasedAt.current = performance.now();
    setBusy('hearing');
    try {
      const heard = await l.stop();
      record('stt.transcribe', performance.now() - releasedAt.current);
      setBusy(null);
      setCaption('');
      if (heard) await send(heard, true);
      else setError(t("I didn't catch that. Hold the button while you speak."));
    } catch (e) {
      setBusy(null);
      setCaption('');
      setError((e as Error).message);
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (listening) return void stopListening();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startListening();
  };
  const onPointerUp = () => {
    if (listening) void stopListening();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (e.type === 'keydown' && !e.repeat) startListening();
    if (e.type === 'keyup') void stopListening();
  };

  const status =
    busy === 'hearing'
      ? t('Listening back…')
      : busy === 'remembering'
        ? t('{name} is tidying its memories…', { name: soul.name })
        : busy === 'thinking' && llm.state === 'loading'
          ? t("Waking {name}'s voice… {n}%", { name: soul.name, n: Math.round(llm.progress * 100) })
          : null;

  return (
    <main className="screen screen--flush talk">
      <header className="talk__head">
        <button
          className="icon-btn icon-btn--bare"
          aria-label={t('Back to your hearth')}
          onClick={() => goBack({ name: 'home' })}
        >
          <Back />
        </button>
        <Link to={{ name: 'soul', id: soul.id }} className="talk__who">
          <Portrait soul={soul} size={44} />
          <span className="stack" style={{ gap: 0, minWidth: 0 }}>
            <span className="talk__name">{soul.name}</span>
            <span className="talk__title">{soul.title}</span>
          </span>
        </Link>
        <button
          className="icon-btn icon-btn--bare"
          aria-label={t('Speak replies aloud')}
          aria-pressed={aloud}
          onClick={() => {
            const next = !aloud;
            setAloud(next);
            if (!next) stopSpeaking();
            void saveSettings({ speak: next });
          }}
        >
          {aloud ? <Speaker /> : <Muted />}
        </button>
      </header>

      <section className="talk__log" aria-label={t('Conversation')} aria-live="polite">
        <p className="talk__day">
          {t('Woke up {date}', {
            date: new Date(soul.createdAt).toLocaleDateString(currentLang() === 'es' ? 'es-ES' : 'en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }),
          })}
        </p>
        {soul.history.map((m, i) =>
          m.role === 'user' ? (
            <p key={i} className="bubble bubble--me">
              {m.content}
            </p>
          ) : (
            // Tapping something it said makes it say it again: easy for children who cannot read yet.
            <button
              key={i}
              type="button"
              className="bubble bubble--it bubble--replay"
              onClick={() => {
                stopSpeaking();
                speak(m.content, soul);
              }}
            >
              {m.content}
              <span className="sr-only">{t('(say it again)')}</span>
            </button>
          ),
        )}
        {pending && <p className="bubble bubble--me">{pending}</p>}
        {streaming !== null && (
          <p className="bubble bubble--it">
            {streaming || <span className="dots" aria-label={t('{name} is thinking', { name: soul.name })} />}
          </p>
        )}
        {listening && <p className="bubble bubble--me bubble--caption">{caption || t('Listening…')}</p>}
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <div ref={end} />
      </section>

      <footer className="talk__foot">
        {status && (
          <p className="talk__status" role="status">
            {status}
          </p>
        )}
        {mode === 'voice' ? (
          <div className="talk__row">
            <button
              className="icon-btn talk__switch"
              aria-label={t('Type instead')}
              onClick={() => setMode('text')}
            >
              <Keyboard />
            </button>
            <button
              className={`btn btn--primary talk__hold${listening ? ' talk__hold--on' : ''}`}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKey}
              onKeyUp={onKey}
              onContextMenu={e => e.preventDefault()}
              disabled={!!busy && !listening}
              aria-pressed={listening}
            >
              <Mic />
              {listening ? t('Listening… let go to send') : t('Hold to talk')}
            </button>
          </div>
        ) : (
          <form
            className="talk__row"
            onSubmit={e => {
              e.preventDefault();
              unlockSpeech();
              const text = draft;
              setDraft('');
              void send(text, false);
            }}
          >
            {hearing && (
              <button
                type="button"
                className="icon-btn talk__switch"
                aria-label={t('Talk instead')}
                onClick={() => setMode('voice')}
              >
                <Mic />
              </button>
            )}
            <label className="sr-only" htmlFor="talk-input">
              {t('Message to {name}', { name: soul.name })}
            </label>
            <input
              id="talk-input"
              className="field__input talk__input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={t('Say something to {name}', { name: soul.name })}
              autoComplete="off"
              enterKeyHint="send"
              maxLength={300}
            />
            <button className="icon-btn talk__send" aria-label={t('Send')} disabled={!!busy || !draft.trim()}>
              <Send />
            </button>
          </form>
        )}
      </footer>
    </main>
  );
}
