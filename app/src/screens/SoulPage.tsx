// A soul's page: who it is and what it remembers, and a way to let it sleep for good.
import { useEffect, useRef } from 'react';
import { goBack, navigate } from '../router';
import { forgetSoul, useSouls } from '../store/souls';
import { Back } from '../ui/icons';
import { Link } from '../ui/Link';
import { Portrait, tintOf } from '../ui/Portrait';
import { useTitle } from '../ui/useTitle';

// The memory summary reads best as separate facts.
export const memoryFacts = (memory: string) =>
  memory
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

export function SoulPage({ id }: { id: string }) {
  const souls = useSouls();
  const soul = souls?.find(s => s.id === id) ?? null;
  const dialog = useRef<HTMLDialogElement>(null);
  useTitle(soul ? `${soul.name}'s soul` : '');

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
          aria-label="Back"
          onClick={() => goBack({ name: 'talk', id: soul.id })}
        >
          <Back />
        </button>
      </header>

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
        <ul className="chips" aria-label="Traits">
          {soul.traits.map(t => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <section className="stack">
        <h2 className="eyebrow">What it remembers</h2>
        {facts.length ? (
          <ul className="memories">
            {facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        ) : (
          <p className="lede">
            {talked
              ? `Nothing yet. After a few more chats, ${soul.name} starts keeping what matters.`
              : `Nothing yet. ${soul.name} has only just woken up.`}
          </p>
        )}
        <p className="lede" style={{ fontSize: 13 }}>
          It looks like: {soul.description}
        </p>
      </section>

      <div className="spacer" />

      <div className="stack" style={{ gap: 6 }}>
        <Link to={{ name: 'talk', id: soul.id }} className="btn btn--primary">
          Talk to {soul.name}
        </Link>
        <button className="btn btn--danger" onClick={() => dialog.current?.showModal()}>
          Let it sleep for good
        </button>
      </div>

      <dialog ref={dialog} className="sheet" aria-labelledby="forget-title">
        <h2 id="forget-title" className="display" style={{ fontSize: 24 }}>
          Let {soul.name} sleep for good?
        </h2>
        <p className="lede">It will forget everything, and waking the same thing again makes someone new.</p>
        <div className="stack" style={{ gap: 6 }}>
          <button className="btn btn--primary btn--danger-fill" onClick={() => void forget()}>
            Let it sleep
          </button>
          <button className="btn btn--quiet" onClick={() => dialog.current?.close()}>
            Keep {soul.name}
          </button>
        </div>
      </dialog>
    </main>
  );
}
