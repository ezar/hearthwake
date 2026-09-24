// A private diary: write or dictate entries, and let the model reflect on the last ones. Entries stay in this
// device's storage; the model runs here too (ADR 0024).
import { useEffect, useRef, useState } from 'react';
import { ensureLlm, useEngine } from '../engine/engine';
import { reflectPrompt, stripStageDirections, streamAnswer } from '../engine/llm';
import { canHear, listen, type Listening } from '../engine/voice';
import { currentLang, useT } from '../i18n';
import { goBack } from '../router';
import { addEntry, deleteEntry, loadDiary, useDiary } from '../store/diary';
import { Back, Mic } from '../ui/icons';
import { useTitle } from '../ui/useTitle';

export function Diary() {
  const t = useT();
  const entries = useDiary();
  const { device } = useEngine();
  const hearing = !!device?.speechRecognition && canHear();
  const [draft, setDraft] = useState('');
  const [reflection, setReflection] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const listener = useRef<Listening | null>(null);
  useTitle(t('Private diary'));

  useEffect(() => {
    void loadDiary();
  }, []);

  const save = async () => {
    if (!draft.trim()) return;
    await addEntry(draft);
    setDraft('');
  };

  const dictate = async () => {
    setError(null);
    if (listener.current) {
      const l = listener.current;
      listener.current = null;
      setListening(false);
      try {
        const heard = await l.stop();
        if (heard) setDraft(d => (d ? `${d} ${heard}` : heard));
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }
    try {
      listener.current = listen();
      setListening(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const reflect = async () => {
    if (!entries?.length) return;
    setThinking(true);
    setError(null);
    setReflection('');
    try {
      let shown = '';
      await streamAnswer(await ensureLlm(), reflectPrompt(entries), d => {
        shown += d;
        setReflection(stripStageDirections(shown));
      });
    } catch (e) {
      setError((e as Error).message || t('It could not answer'));
      setReflection(null);
    } finally {
      setThinking(false);
    }
  };

  const locale = currentLang() === 'es' ? 'es-ES' : 'en-US';

  return (
    <main className="screen">
      <header className="bar">
        <button
          className="icon-btn icon-btn--bare"
          aria-label={t('Back')}
          onClick={() => goBack({ name: 'lab' })}
        >
          <Back />
        </button>
      </header>
      <section className="stack" style={{ gap: 6 }}>
        <h1>{t('Private diary')}</h1>
        <p className="lede">{t('Entries stay on this device, and so does the model that reads them.')}</p>
      </section>

      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="sr-only" htmlFor="diary-entry">
          {t('Today')}
        </label>
        <textarea
          id="diary-entry"
          className="field__input"
          rows={4}
          value={draft}
          maxLength={2000}
          placeholder={t('How was today?')}
          onChange={e => setDraft(e.target.value)}
        />
        <div className="talk__row">
          {hearing && (
            <button
              type="button"
              className={`icon-btn talk__switch${listening ? ' icon-btn--on' : ''}`}
              aria-label={listening ? t('Stop dictating') : t('Dictate')}
              aria-pressed={listening}
              onClick={() => void dictate()}
            >
              <Mic />
            </button>
          )}
          <button className="btn btn--primary" style={{ flexGrow: 1 }} disabled={!draft.trim()}>
            {t('Save entry')}
          </button>
        </div>
      </form>

      {entries && entries.length > 0 && (
        <button className="btn btn--quiet" disabled={thinking} onClick={() => void reflect()}>
          {thinking ? t('Reading your diary…') : t('Reflect on my week')}
        </button>
      )}
      {reflection !== null && (
        <p className="bubble bubble--it" aria-live="polite" style={{ maxWidth: '100%' }}>
          {reflection || <span className="dots" aria-label={t('Thinking')} />}
        </p>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      <ul className="memories" aria-label={t('Entries')}>
        {[...(entries ?? [])].reverse().map(e => (
          <li key={e.id} className="diary__entry">
            <span className="setting__detail">
              {new Date(e.at).toLocaleString(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{e.text}</span>
            <button className="btn btn--danger diary__delete" onClick={() => void deleteEntry(e.id)}>
              {t('Delete')}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
