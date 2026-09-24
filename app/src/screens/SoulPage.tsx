// A soul's page: who it is and what it remembers, and a way to let it sleep for good.
import { useEffect, useRef, useState } from 'react';
import { goBack, navigate } from '../router';
import { forgetSoul, useSouls } from '../store/souls';
import { Back, Share } from '../ui/icons';
import { Link } from '../ui/Link';
import { Portrait, tintOf } from '../ui/Portrait';
import { shareSoul } from '../ui/shareCard';
import { useTitle } from '../ui/useTitle';
import { useT } from '../i18n';

// The memory summary reads best as separate facts.
export const memoryFacts = (memory: string) =>
  memory
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

export function SoulPage({ id }: { id: string }) {
  const t = useT();
  const souls = useSouls();
  const soul = souls?.find(s => s.id === id) ?? null;
  const dialog = useRef<HTMLDialogElement>(null);
  const [sharing, setSharing] = useState<null | 'busy' | 'downloaded' | 'failed'>(null);
  useTitle(soul ? t("{name}'s soul", { name: soul.name }) : '');

  useEffect(() => {
    if (souls && !soul) navigate({ name: 'home' }, { replace: true });
  }, [souls, soul]);

  if (!soul) return <main className="screen" />;
  const facts = memoryFacts(soul.memory);
  const talked = soul.history.some(m => m.role === 'user');

  const forget = async () => {
    dialog.current?.close();
    await forgetSoul(soul.id);
    navigate({ name: 'home' }, { replace: true });
  };

  return (
    <main className="screen soul">
      <header className="bar">
        <button
          className="icon-btn icon-btn--bare"
          aria-label={t('Back')}
          onClick={() => goBack({ name: 'talk', id: soul.id })}
        >
          <Back />
        </button>
        <button
          className="btn btn--quiet"
          disabled={sharing === 'busy'}
          onClick={async () => {
            setSharing('busy');
            try {
              const how = await shareSoul(soul);
              setSharing(how === 'downloaded' ? 'downloaded' : null);
            } catch {
              setSharing('failed');
            }
          }}
        >
          <Share size={20} /> {t('Share')}
        </button>
      </header>
      {sharing === 'downloaded' && (
        <p className="notice" role="status">
          {t("{name}'s card is in your downloads.", { name: soul.name })}
        </p>
      )}
      {sharing === 'failed' && (
        <p className="notice notice--error" role="alert">
          {t('The card could not be made. Try again.')}
        </p>
      )}

      <section className="soul__hero">
        <Portrait soul={soul} size={132} ring={3} />
        <h1 className="soul__name">{soul.name}</h1>
        <p className="lede soul__title">
          {soul.title}
          {soul.archetype && ` · ${soul.archetype}`}
        </p>
        {soul.catchphrase && (
          <p className="soul__catch" style={{ color: tintOf(soul).tint }}>
            “{soul.catchphrase}”
          </p>
        )}
      </section>

      {soul.traits.length > 0 && (
        <ul className="chips" aria-label={t('Traits')}>
          {soul.traits.map(t => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <section className="stack">
        <h2 className="eyebrow">{t('What it remembers')}</h2>
        {facts.length ? (
          <ul className="memories">
            {facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        ) : (
          <p className="lede">
            {talked
              ? t('Nothing yet. After a few more chats, {name} starts keeping what matters.', {
                  name: soul.name,
                })
              : t('Nothing yet. {name} has only just woken up.', { name: soul.name })}
          </p>
        )}
        <p className="lede" style={{ fontSize: 13 }}>
          {t('It looks like: {description}', { description: soul.description })}
        </p>
      </section>

      <div className="spacer" />

      <div className="stack" style={{ gap: 6 }}>
        <Link to={{ name: 'talk', id: soul.id }} className="btn btn--primary">
          {t('Talk to {name}', { name: soul.name })}
        </Link>
        <button className="btn btn--danger" onClick={() => dialog.current?.showModal()}>
          {t('Let it sleep for good')}
        </button>
      </div>

      <dialog ref={dialog} className="sheet" aria-labelledby="forget-title">
        <h2 id="forget-title" className="display" style={{ fontSize: 24 }}>
          {t('Let {name} sleep for good?', { name: soul.name })}
        </h2>
        <p className="lede">
          {t('It will forget everything, and waking the same thing again makes someone new.')}
        </p>
        <div className="stack" style={{ gap: 6 }}>
          <button className="btn btn--primary btn--danger-fill" onClick={() => void forget()}>
            {t('Let it sleep')}
          </button>
          <button className="btn btn--quiet" onClick={() => dialog.current?.close()}>
            {t('Keep {name}', { name: soul.name })}
          </button>
        </div>
      </dialog>
    </main>
  );
}
