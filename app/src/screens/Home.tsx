// The hearth: everything that has woken up, most recently talked to first.
import { ensureLlm, useEngine } from '../engine/engine';
import { useSouls } from '../store/souls';
import { Camera, Flame, Search, Sliders, Talking } from '../ui/icons';
import { canHunt } from './Hunt';
import { Link } from '../ui/Link';
import { Portrait } from '../ui/Portrait';
import { shortWhen } from '../ui/time';
import { useTitle } from '../ui/useTitle';

const COUNT = ['No things', 'One thing', 'Two things', 'Three things', 'Four things', 'Five things'];

export function Home({ interrupted }: { interrupted: string[] }) {
  const souls = useSouls();
  const { llm } = useEngine();
  const count = souls?.length ?? 0;
  useTitle('');

  return (
    <main className="screen">
      <header className="bar">
        <span className="wordmark">
          <span style={{ color: 'var(--ember)', display: 'flex' }}>
            <Flame />
          </span>
          Hearthwake
        </span>
        <Link to={{ name: 'settings' }} className="icon-btn" aria-label="Settings">
          <Sliders size={20} />
        </Link>
      </header>

      {interrupted.length > 0 && (
        <p className="notice" role="status">
          Hearthwake closed suddenly last time, while it was trying to {interrupted.join(' and ')}. The phone
          probably ran out of memory: close other tabs and apps, then try again.
        </p>
      )}
      {llm.state === 'loading' && (
        <p className="pill" role="status">
          <span className="pill__dot" /> Getting ready… {Math.round(llm.progress * 100)}%
        </p>
      )}
      {llm.state === 'error' && (
        <p className="notice notice--error" role="alert">
          The voice of your things could not load ({llm.message}).{' '}
          <button
            className="btn btn--quiet"
            style={{ minHeight: 0, padding: 0 }}
            onClick={() => void ensureLlm()}
          >
            Try again
          </button>
        </p>
      )}

      <section className="stack" style={{ gap: 6 }}>
        <h1>{count ? "Who's awake" : 'All quiet'}</h1>
        <p className="lede">
          {count === 0
            ? 'Nothing has woken up yet. Point your phone at something in your home: a lamp, a kettle, a door.'
            : `${COUNT[count] ?? `${count} things`} in your home ${count === 1 ? 'has' : 'have'} something to say.`}
        </p>
      </section>

      {souls && count > 0 ? (
        <ul className="soul-list">
          {souls.map(soul => (
            <li key={soul.id}>
              <Link to={{ name: 'talk', id: soul.id }} className="soul-row">
                <Portrait soul={soul} />
                <span className="soul-row__text">
                  <span className="soul-row__name">{soul.name}</span>
                  <span className="soul-row__title">{soul.title}</span>
                </span>
                <span className="soul-row__when">{shortWhen(soul.lastTalkedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty" aria-hidden="true">
          <span className="empty__glow">
            <Flame size={64} />
          </span>
        </div>
      )}

      {count >= 2 && (
        <section className="stack" aria-labelledby="play-title">
          <h2 id="play-title" className="eyebrow">
            Play
          </h2>
          <div className="activities">
            <Link to={{ name: 'together' }} className="activity">
              <span className="activity__icon">
                <Talking />
              </span>
              <span className="activity__title">Let them talk</span>
              <span className="activity__detail">Two things chat, out loud</span>
            </Link>
            {canHunt(souls) && (
              <Link to={{ name: 'hunt' }} className="activity">
                <span className="activity__icon">
                  <Search />
                </span>
                <span className="activity__title">Treasure hunt</span>
                <span className="activity__detail">Solve a riddle, find the thing</span>
              </Link>
            )}
          </div>
        </section>
      )}

      <div className="spacer" />

      <div className="stack home__actions">
        <Link to={{ name: 'wake' }} className="btn btn--primary">
          <Camera />
          Wake something
        </Link>
        <Link to={{ name: 'describe' }} className="btn btn--quiet">
          Describe it instead
        </Link>
      </div>
    </main>
  );
}
