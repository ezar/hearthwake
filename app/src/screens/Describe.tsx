// Waking a thing from words, for when the camera is not an option.
import { useState, type FormEvent } from 'react';
import { unlockSpeech } from '../engine/voice';
import { setPendingWake } from '../engine/wake';
import { goBack, navigate } from '../router';
import { Back } from '../ui/icons';

export function Describe() {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    unlockSpeech();
    setPendingWake({ kind: 'words', label, description });
    navigate({ name: 'waking' }, { replace: true });
  };

  return (
    <main className="screen">
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
        <h1>Describe it</h1>
        <p className="lede">Tell Hearthwake what the thing is and what it looks like.</p>
      </section>
      <form className="stack form" style={{ gap: 18 }} onSubmit={submit}>
        <label className="field">
          <span className="field__label">What is it?</span>
          <input
            className="field__input"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="a teapot"
            maxLength={40}
            autoComplete="off"
            required
          />
        </label>
        <label className="field">
          <span className="field__label">What does it look like?</span>
          <textarea
            className="field__input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Round and blue, with a chipped spout."
            maxLength={120}
            rows={3}
          />
        </label>
        <button className="btn btn--primary btn--block" disabled={!label.trim()}>
          Wake it
        </button>
      </form>
    </main>
  );
}
