// Settings: sound, storage, diagnostics and a way back to the M0 test harness.
import { useEffect, useState } from 'react';
import { clearModelCaches, storageUsageMB } from '../engine/device';
import { engineState } from '../engine/engine';
import { snapshot } from '../engine/metrics';
import { goBack } from '../router';
import { loadSettings, saveSettings, type Settings as AppSettings } from '../store/settings';
import { useSouls } from '../store/souls';
import { Back } from '../ui/icons';

export function Settings() {
  const souls = useSouls();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void storageUsageMB().then(setUsage);
  }, []);

  const toggleSpeak = async () => setSettings(await saveSettings({ speak: !settings?.speak }));

  const deleteModels = async () => {
    if (
      !confirm(
        'Delete the downloaded models? Your things keep their souls, and the models download again next time.',
      )
    )
      return;
    const count = await clearModelCaches();
    setUsage(await storageUsageMB());
    setNote(
      `Deleted ${count} model ${count === 1 ? 'cache' : 'caches'}. Reload the app to download them again.`,
    );
  };

  const copyDiagnostics = async () => {
    const { device, mock, llm } = engineState();
    const report = {
      at: new Date().toISOString(),
      app: __APP_VERSION__,
      mock,
      device,
      llm,
      souls: souls?.length ?? 0,
      ...snapshot(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setNote('Diagnostics copied. Paste them wherever you need them.');
    } catch {
      setNote('The clipboard is not available here.');
    }
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
      <h1>Settings</h1>

      <section className="settings-list">
        <label className="setting">
          <span className="stack" style={{ gap: 2 }}>
            <span className="setting__title">Speak replies aloud</span>
            <span className="setting__detail">With your device's voices. Off, replies are text only.</span>
          </span>
          <input
            type="checkbox"
            className="switch"
            role="switch"
            checked={settings?.speak ?? true}
            onChange={() => void toggleSpeak()}
          />
        </label>

        <div className="setting">
          <span className="stack" style={{ gap: 2 }}>
            <span className="setting__title">Downloaded models</span>
            <span className="setting__detail">
              {usage === null ? 'Space used is unknown.' : `About ${usage} MB used on this device.`}
            </span>
          </span>
          <button className="btn btn--quiet" onClick={() => void deleteModels()}>
            Delete
          </button>
        </div>

        <div className="setting">
          <span className="stack" style={{ gap: 2 }}>
            <span className="setting__title">Diagnostics</span>
            <span className="setting__detail">Timings and events from this visit, to report a problem.</span>
          </span>
          <button className="btn btn--quiet" onClick={() => void copyDiagnostics()}>
            Copy
          </button>
        </div>

        <a className="setting setting--link" href={`${import.meta.env.BASE_URL}poc/`}>
          <span className="stack" style={{ gap: 2 }}>
            <span className="setting__title">Test harness</span>
            <span className="setting__detail">The M0 feasibility spike, to measure models one by one.</span>
          </span>
          <span aria-hidden="true">›</span>
        </a>
      </section>

      {note && (
        <p className="notice" role="status">
          {note}
        </p>
      )}

      <div className="spacer" />
      <p className="lede" style={{ fontSize: 13, textAlign: 'center' }}>
        Hearthwake {__APP_VERSION__}. The AI runs on this device. Speech recognition is your browser's, which
        may use its maker's servers.
      </p>
    </main>
  );
}
