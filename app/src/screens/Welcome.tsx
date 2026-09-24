// First run: what Hearthwake is, what this phone can do, and the one-time model download.
import { useState } from 'react';
import { requestPersistence } from '../engine/device';
import { ensureLlm, useEngine } from '../engine/engine';
import { unlockSpeech } from '../engine/voice';
import { useT } from '../i18n';
import { Check, Download, Flame, Keyboard } from '../ui/icons';
import { useTitle } from '../ui/useTitle';
import { useWakeLock } from '../ui/useWakeLock';

export function Welcome({ onDone }: { onDone: () => void }) {
  const { device, llm, model } = useEngine();
  const t = useT();
  const [started, setStarted] = useState(false);

  const start = async () => {
    unlockSpeech();
    setStarted(true);
    void requestPersistence();
    try {
      await ensureLlm();
      onDone();
    } catch {
      // The status below shows the error and offers a retry.
    }
  };

  const loading = llm.state === 'loading';
  useTitle(t('Welcome'));
  useWakeLock(started && loading);
  const percent = loading ? Math.round(llm.progress * 100) : llm.state === 'ready' ? 100 : 0;
  const downloadedMB = Math.round((percent / 100) * model.memoryMB);

  return (
    <main className="screen welcome">
      <span className="welcome__mark">
        <Flame size={56} />
      </span>
      <section className="stack" style={{ gap: 12 }}>
        <h1 className="welcome__title">{t('The things in your home are about to wake up.')}</h1>
        <p className="lede">
          {t(
            'Point your phone at a lamp, a kettle or a door, and it will have a name, a voice and something to say.',
          )}
        </p>
      </section>

      <ul className="checklist card">
        <li>
          <span className="ok">
            <Check />
          </span>
          {/iPhone|iPad|Android/.test(device?.userAgent ?? '')
            ? t('This phone can run it')
            : t('This device can run it')}
        </li>
        <li>
          <span className="ok">
            <Check />
          </span>
          {t('Souls and memories stay on this device')}
        </li>
        {!device?.speechRecognition && (
          <li>
            <span className="accent">
              <Keyboard />
            </span>
            {t('This browser cannot listen, so you will type to them')}
          </li>
        )}
        <li>
          <span className="accent">
            <Download />
          </span>
          {t('A one-time download of about {mb} MB. Use Wi-Fi.', { mb: model.memoryMB })}
        </li>
      </ul>

      <div className="spacer" />

      {started && loading && (
        <section aria-live="polite" className="stack" style={{ gap: 8 }}>
          <div className="bar" style={{ fontSize: 14 }}>
            <span>{percent < 100 ? t('Teaching it to talk…') : t('Almost there…')}</span>
            <span style={{ color: 'var(--muted)' }}>
              {t('{done} of {total} MB', { done: downloadedMB, total: model.memoryMB })}
            </span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-label={t('Download')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className="lede" style={{ fontSize: 13 }}>
            {t('Keep this screen open. Next time it starts in a few seconds.')}
          </p>
        </section>
      )}

      {llm.state === 'error' && (
        <p className="notice notice--error" role="alert">
          {t('The download stopped: {message}. Check your connection, close other tabs, and try again.', {
            message: llm.message,
          })}
        </p>
      )}

      <button className="btn btn--primary btn--block" onClick={start} disabled={started && loading}>
        {llm.state === 'error' ? t('Try again') : started && loading ? t('Downloading…') : t('Get started')}
      </button>
    </main>
  );
}
