// Two things talk to each other: pick two, give them a topic, and listen. Each line is written by the LLM
// as that thing and spoken in its own voice.
import { useEffect, useRef, useState } from 'react';
import { ensureLlm } from '../engine/engine';
import { nextLine, stripStageDirections, TOGETHER_LINES, type Line } from '../engine/llm';
import { log } from '../engine/metrics';
import { sentenceSplitter, speak, stopSpeaking, unlockSpeech } from '../engine/voice';
import { goBack } from '../router';
import { loadSettings } from '../store/settings';
import { useSouls, type Soul } from '../store/souls';
import { Back } from '../ui/icons';
import { Portrait } from '../ui/Portrait';
import { useTitle } from '../ui/useTitle';

const TOPICS = [
  'who is the most useful',
  'the best spot in the house',
  'what the family did today',
  'a secret',
];

export function Together() {
  const souls = useSouls();
  const [picked, setPicked] = useState<string[]>([]);
  const [topic, setTopic] = useState(TOPICS[0]!);
  const [lines, setLines] = useState<Line[]>([]);
  const [live, setLive] = useState<Line | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  useTitle('Let them talk');

  useEffect(
    () => () => {
      stop.current = true;
      stopSpeaking();
    },
    [],
  );

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [lines.length, live]);

  const toggle = (id: string) =>
    setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p.slice(-1), id]));

  const pair = picked.map(id => souls?.find(s => s.id === id)).filter((s): s is Soul => !!s);

  const start = async () => {
    if (pair.length !== 2) return;
    unlockSpeech();
    stop.current = false;
    setError(null);
    setLines([]);
    setRunning(true);
    try {
      const [llm, settings] = await Promise.all([ensureLlm(), loadSettings()]);
      const said: Line[] = [];
      for (let i = 0; i < TOGETHER_LINES && !stop.current; i++) {
        const speaker = pair[i % 2]!;
        const other = pair[(i + 1) % 2]!;
        const splitter = sentenceSplitter();
        const say = (s: string) => {
          const clean = stripStageDirections(s);
          if (settings.speak && clean) speak(clean, speaker);
        };
        let shown = '';
        setLive({ speaker: speaker.id, text: '' });
        const text = await nextLine(llm, speaker, other, topic, said, d => {
          shown += d;
          setLive({ speaker: speaker.id, text: stripStageDirections(shown) });
          splitter.push(d).forEach(say);
        });
        splitter.flush().forEach(say);
        if (!text) break;
        said.push({ speaker: speaker.id, text });
        setLines([...said]);
        setLive(null);
      }
    } catch (e) {
      log(`Together failed: ${(e as Error).message}`);
      setError((e as Error).message || 'They fell silent');
    } finally {
      setLive(null);
      setRunning(false);
    }
  };

  const who = (id: string) => souls?.find(s => s.id === id);
  const shown = live ? [...lines, live] : lines;

  return (
    <main className="screen together">
      <header className="bar">
        <button
          className="icon-btn icon-btn--bare"
          aria-label="Back"
          onClick={() => goBack({ name: 'home' })}
        >
          <Back />
        </button>
      </header>
      <section className="stack" style={{ gap: 6 }}>
        <h1>Let them talk</h1>
        <p className="lede">Pick two things and a topic, and listen to them chat.</p>
      </section>

      <fieldset className="picker" disabled={running}>
        <legend className="eyebrow">Who</legend>
        <div className="picker__grid">
          {souls?.map(soul => (
            <label
              key={soul.id}
              className={`picker__item${picked.includes(soul.id) ? ' picker__item--on' : ''}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={picked.includes(soul.id)}
                onChange={() => toggle(soul.id)}
              />
              <Portrait soul={soul} size={56} />
              <span className="picker__name">{soul.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="picker" disabled={running}>
        <legend className="eyebrow">About</legend>
        <div className="chips chips--left">
          {TOPICS.map(t => (
            <button
              key={t}
              type="button"
              className={`chip${t === topic ? ' chip--on' : ''}`}
              aria-pressed={t === topic}
              onClick={() => setTopic(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      {shown.length > 0 && (
        <section className="together__log" aria-label="Their conversation" aria-live="polite">
          {shown.map((line, i) => {
            const soul = who(line.speaker);
            const left = soul?.id === pair[0]?.id;
            return (
              <div key={i} className={`together__line${left ? '' : ' together__line--right'}`}>
                {soul && <Portrait soul={soul} size={36} />}
                <p className="bubble bubble--it">
                  <span className="together__who">{soul?.name}</span>
                  {line.text || <span className="dots" aria-label="Thinking" />}
                </p>
              </div>
            );
          })}
          <div ref={end} />
        </section>
      )}

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      <div className="spacer" />
      {running ? (
        <button
          className="btn btn--quiet"
          onClick={() => {
            stop.current = true;
            stopSpeaking();
          }}
        >
          Stop them
        </button>
      ) : (
        <button
          className="btn btn--primary btn--block"
          disabled={pair.length !== 2}
          onClick={() => void start()}
        >
          {pair.length === 2 ? `Let ${pair[0]!.name} and ${pair[1]!.name} talk` : 'Pick two things'}
        </button>
      )}
    </main>
  );
}
