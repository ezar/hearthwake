// The hearth: everything that has woken up, most recently talked to first.
import { ensureLlm, useEngine } from '../engine/engine';
import { useSouls } from '../store/souls';
import { Camera, Flame, Search, Sliders, Talking } from '../ui/icons';
import { canHunt } from './Hunt';
import { Link } from '../ui/Link';
import { Portrait } from '../ui/Portrait';
import { shortWhen } from '../ui/time';
import { useT } from '../i18n';
import { useTitle } from '../ui/useTitle';

// Small counts read better as words.
const NUMBERS = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

export function Home({ interrupted }: { interrupted: string[] }) {
  const souls = useSouls();
  const { llm } = useEngine();
  const count = souls?.length ?? 0;
  const t = useT();
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
        <Link to={{ name: 'settings' }} className="icon-btn" aria-label={t('Settings')}>
          <Sliders size={20} />
        </Link>
      </header>

      {interrupted.length > 0 && (
        <p className="notice" role="status">
          {t(
            'Hearthwake closed suddenly last time, while it was trying to {what}. The phone probably ran out of memory: close other tabs and apps, then try again.',
            { what: interrupted.map(a => t(a)).join(t(' and ')) },
          )}
        </p>
      )}
      {llm.state === 'loading' && (
        <p className="pill" role="status">
          <span className="pill__dot" /> {t('Getting ready… {n}%', { n: Math.round(llm.progress * 100) })}
        </p>
      )}
      {llm.state === 'error' && (
        <p className="notice notice--error" role="alert">
          {t('The voice of your things could not load ({message}).', { message: llm.message })}{' '}
          <button
            className="btn btn--quiet"
            style={{ minHeight: 0, padding: 0 }}
            onClick={() => void ensureLlm()}
          >
            {t('Try again')}
          </button>
        </p>
      )}

      <section className="stack" style={{ gap: 6 }}>
        <h1>{count ? t("Who's awake") : t('All quiet')}</h1>
        <p className="lede">
          {count === 0
            ? t(
                'Nothing has woken up yet. Point your phone at something in your home: a lamp, a kettle, a door.',
              )
            : count === 1
              ? t('One thing in your home has something to say.')
              : t('{n} things in your home have something to say.', {
                  n: NUMBERS[count] ? t(NUMBERS[count]!) : count,
                })}
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
            {t('Play')}
          </h2>
          <div className="activities">
            <Link to={{ name: 'together' }} className="activity">
              <span className="activity__icon">
                <Talking />
              </span>
              <span className="activity__title">{t('Let them talk')}</span>
              <span className="activity__detail">{t('Two things chat, out loud')}</span>
            </Link>
            {canHunt(souls) && (
              <Link to={{ name: 'hunt' }} className="activity">
                <span className="activity__icon">
                  <Search />
                </span>
                <span className="activity__title">{t('Treasure hunt')}</span>
                <span className="activity__detail">{t('Solve a riddle, find the thing')}</span>
              </Link>
            )}
          </div>
        </section>
      )}

      <Link to={{ name: 'lab' }} className="home__lab">
        {t('Lab: more experiments with on-device AI')} <span aria-hidden="true">›</span>
      </Link>

      <div className="spacer" />

      <div className="stack home__actions">
        <Link to={{ name: 'wake' }} className="btn btn--primary">
          <Camera />
          {t('Wake something')}
        </Link>
        <Link to={{ name: 'describe' }} className="btn btn--quiet">
          {t('Describe it instead')}
        </Link>
      </div>
    </main>
  );
}
