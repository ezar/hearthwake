// The onboarding: what Hearthwake is, how it works and why it is an experiment, in three cards that can be
// swiped or stepped through. Shown before the first download, and again from Settings (ADR 0021).
import { useRef, useState } from 'react';
import { useEngine } from '../engine/engine';
import type { ModelChoice } from '../engine/llm';
import { useT } from '../i18n';
import { Flame, Mic, Phone } from '../ui/icons';
import { TINTS } from '../ui/Portrait';

// The things of the design canvas, drawn as line art in each tint.
const THINGS = [
  {
    name: 'door',
    path: 'M7 3h14v22H7zM14 3v22M11 14h1M16 14h1',
  },
  {
    name: 'lamp',
    path: 'M9 4h10l4 10H5zM14 14v8M9 25h10',
  },
  {
    name: 'kettle',
    path: 'M6 10h14v9a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5zM20 12h2a3 3 0 0 1 0 6h-2M10 4v3M14 3v4M18 4v3',
  },
];

function Things() {
  return (
    <div className="intro__art intro__things" aria-hidden="true">
      {THINGS.map((t, i) => {
        const tint = TINTS[i + 1]!;
        return (
          <span key={t.name} className="intro__thing" style={{ borderColor: tint.tint, background: tint.bg }}>
            <svg
              width="44"
              height="44"
              viewBox="0 0 28 28"
              fill="none"
              stroke={tint.tint}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={t.path} />
            </svg>
          </span>
        );
      })}
    </div>
  );
}

function Chat() {
  const t = useT();
  return (
    <div className="intro__art intro__chat" aria-hidden="true">
      <p className="bubble bubble--it">{t("Oh, you're back! Did Luna ever come home?")}</p>
      <p className="bubble bubble--me">{t('She did! She was under the stairs.')}</p>
      <span className="intro__mic">
        <Mic />
      </span>
    </div>
  );
}

function Local() {
  return (
    <div className="intro__art intro__local" aria-hidden="true">
      <span className="intro__phone">
        <Phone size={72} />
        <span className="intro__spark">
          <Flame size={30} />
        </span>
      </span>
    </div>
  );
}

function cards(t: (s: string, v?: Record<string, string | number>) => string, model: ModelChoice) {
  return [
    {
      art: <Things />,
      title: t('The things in your home wake up.'),
      body: t(
        'Point your phone at a lamp, a kettle or a door. It wakes up with a name, a personality and a voice of its own.',
      ),
    },
    {
      art: <Chat />,
      title: t('Talk to them. They remember.'),
      body: t(
        'Hold the button and speak, or type. They answer out loud, keep what you tell them, and know you when you come back.',
      ),
    },
    {
      art: <Local />,
      title: t('An experiment in AI on your device.'),
      body: t(
        'Everything thinks inside your browser: a language model ({model}, through WebLLM and WebGPU) running on this device. No server, no account. It is early days: the first download is about {mb} MB, waking a thing takes about 20 seconds, and small models write better English than Spanish.',
        { model: model.label, mb: model.memoryMB },
      ),
    },
  ];
}

export function Intro({ onDone, doneLabel }: { onDone: () => void; doneLabel?: string }) {
  const t = useT();
  const { model } = useEngine();
  const CARDS = cards(t, model);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const last = index === CARDS.length - 1;

  // While a button scrolls the cards, scroll events report the pages in between; ignore them until it lands.
  const scrollingTo = useRef<number | null>(null);
  const go = (i: number) => {
    const el = track.current;
    scrollingTo.current = i;
    setIndex(i);
    el?.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    // Never ignore swipes for long, even if the scroll lands a pixel off.
    setTimeout(() => {
      if (scrollingTo.current === i) scrollingTo.current = null;
    }, 900);
  };

  return (
    <main className="screen intro">
      <header className="bar">
        <span className="wordmark">
          <span style={{ color: 'var(--ember)', display: 'flex' }}>
            <Flame />
          </span>
          Hearthwake
        </span>
        {!last && (
          <button className="btn btn--quiet" onClick={onDone}>
            {t('Skip')}
          </button>
        )}
      </header>

      <div
        ref={track}
        className="intro__track"
        onScroll={e => {
          const el = e.currentTarget;
          const at = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (scrollingTo.current !== null) {
            if (Math.abs(el.scrollLeft - scrollingTo.current * el.clientWidth) < 2)
              scrollingTo.current = null;
            return;
          }
          setIndex(at);
        }}
      >
        {CARDS.map((card, i) => (
          <section
            key={i}
            className="intro__card"
            aria-roledescription="slide"
            aria-label={t('{n} of {total}', { n: i + 1, total: CARDS.length })}
            aria-hidden={i !== index}
          >
            {card.art}
            <h1 className="intro__title">{card.title}</h1>
            <p className="lede intro__body">{card.body}</p>
          </section>
        ))}
      </div>

      <div className="intro__dots" role="tablist" aria-label={t('Pages')}>
        {CARDS.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === index}
            aria-label={t('Page {n}', { n: i + 1 })}
            className={`intro__dot${i === index ? ' intro__dot--on' : ''}`}
            onClick={() => go(i)}
          />
        ))}
      </div>

      <button className="btn btn--primary btn--block" onClick={() => (last ? onDone() : go(index + 1))}>
        {last ? (doneLabel ?? t("Let's begin")) : t('Next')}
      </button>
    </main>
  );
}
