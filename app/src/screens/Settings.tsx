// Settings: sound, storage, diagnostics and a way back to the M0 test harness.
import { useEffect, useState } from 'react';
import { clearModelCaches, storageUsageMB } from '../engine/device';
import { engineState, setModel, useEngine } from '../engine/engine';
import { MODELS, modelByKey } from '../engine/llm';
import { LANGS, setLang, useT, type Lang } from '../i18n';
import { snapshot } from '../engine/metrics';
import { goBack } from '../router';
import { loadSettings, saveSettings, type Settings as AppSettings } from '../store/settings';
import { useSouls } from '../store/souls';
import { Back } from '../ui/icons';
import { Link } from '../ui/Link';
import { useTitle } from '../ui/useTitle';

export function Settings() {
  const t = useT();
  const souls = useSouls();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useTitle(t('Settings'));

  useEffect(() => {
    void loadSettings().then(setSettings);
    void storageUsageMB().then(setUsage);
  }, []);

  const { model } = useEngine();
  const [modelChanged, setModelChanged] = useState(false);

  const toggleSpeak = async () => setSettings(await saveSettings({ speak: !settings?.speak }));

  const changeLang = async (lang: Lang) => {
    setLang(lang);
    setSettings(await saveSettings({ lang }));
  };

  // A new model downloads on the next start, through the first-run screen (ADR 0023).
  const changeModel = async (key: string) => {
    setModel(modelByKey(key));
    setSettings(await saveSettings({ model: key }));
    setModelChanged(true);
  };

  const deleteModels = async () => {
    if (
      !confirm(
        t(
          'Delete the downloaded models? Your things keep their souls, and the models download again next time.',
        ),
      )
    )
      return;
    const count = await clearModelCaches();
    setUsage(await storageUsageMB());
    setNote(t('Deleted {count} model caches. Reload the app to download them again.', { count }));
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
      setNote(t('Diagnostics copied. Paste them wherever you need them.'));
    } catch {
      setNote(t('The clipboard is not available here.'));
    }
  };

  return (
    <main className="screen">
      <header className="bar">
        <button
          className="icon-btn icon-btn--bare"
          aria-label={t('Back')}
          onClick={() => goBack({ name: 'home' })}
        >
          <Back />
        </button>
      </header>
      <h1>{t('Settings')}</h1>

      <section className="settings-list">
        <label className="setting">
          <span className="stack" style={{ gap: 2 }}>
            <span className="setting__title">{t('Language')}</span>
            <span className="setting__detail">{t('For the app, and for what your things say.')}</span>
          </span>
          <select
            className="select"
            value={settings?.lang ?? 'en'}
            onChange={e => void changeLang(e.target.value as Lang)}
          >
            {LANGS.map(l => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="setting setting--column">
          <legend className="setting__title">{t('Model')}</legend>
          <span className="setting__detail">
            {t('Bigger models write better, especially in Spanish, but need more memory and a new download.')}
          </span>
          <div className="stack" style={{ gap: 8 }}>
            {MODELS.map(m => (
              <label key={m.key} className={`option${m.key === model.key ? ' option--on' : ''}`}>
                <input
                  type="radio"
                  name="model"
                  value={m.key}
                  checked={m.key === model.key}
                  onChange={() => void changeModel(m.key)}
                />
                <span className="stack" style={{ gap: 2 }}>
                  <span className="option__title">
                    {m.label} · {t('about {mb} MB', { mb: m.memoryMB })}
                  </span>
                  <span className="setting__detail">{t(m.note)}</span>
                </span>
              </label>
            ))}
          </div>
          {modelChanged && (
            <p className="notice" role="status">
              {t('{model} downloads the next time Hearthwake starts.', { model: model.label })}{' '}
              <button
                className="btn btn--quiet"
                style={{ minHeight: 0, padding: 0 }}
                onClick={() => location.reload()}
              >
                {t('Restart now')}
              </button>
            </p>
          )}
        </fieldset>

        <label className="setting">
          <span className="stack" style={{ gap: 2 }}>
            <span className="setting__title">{t('Speak replies aloud')}</span>
            <span className="setting__detail">
              {t("With your device's voices. Off, replies are text only.")}
            </span>
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
            <span className="setting__title">{t('Downloaded models')}</span>
            <span className="setting__detail">
              {usage === null
                ? t('Space used is unknown.')
                : t('About {mb} MB used on this device.', { mb: usage })}
            </span>
          </span>
          <button className="btn btn--quiet" onClick={() => void deleteModels()}>
            {t('Delete')}
          </button>
        </div>

        <div className="setting">
          <span className="stack" style={{ gap: 2 }}>
            <span className="setting__title">{t('Diagnostics')}</span>
            <span className="setting__detail">
              {t('Timings and events from this visit, to report a problem.')}
            </span>
          </span>
          <button className="btn btn--quiet" onClick={() => void copyDiagnostics()}>
            {t('Copy')}
          </button>
        </div>

        <Link to={{ name: 'about' }} className="setting setting--link">
          <span className="stack" style={{ gap: 2 }}>
            <span className="setting__title">{t('About this experiment')}</span>
            <span className="setting__detail">{t('What Hearthwake is and how it works.')}</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>

        <a className="setting setting--link" href={`${import.meta.env.BASE_URL}poc/`}>
          <span className="stack" style={{ gap: 2 }}>
            <span className="setting__title">{t('Test harness')}</span>
            <span className="setting__detail">
              {t('The M0 feasibility spike, to measure models one by one.')}
            </span>
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
        {t(
          "Hearthwake {version}. The AI runs on this device. Speech recognition is your browser's, which may use its maker's servers.",
          { version: __APP_VERSION__ },
        )}
      </p>
    </main>
  );
}
