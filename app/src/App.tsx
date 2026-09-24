// Startup, the first-run gate and the screen for the current route.
import { useEffect, useState } from 'react';
import { ensureLlm, initEngine, llmIsCached, setModel } from './engine/engine';
import { modelByKey } from './engine/llm';
import { setLang, t, useT } from './i18n';
import { takeInterruptedActivities } from './engine/metrics';
import { unlockSpeech } from './engine/voice';
import { goBack, navigate, useRoute } from './router';
import { Describe } from './screens/Describe';
import { Home } from './screens/Home';
import { Hunt } from './screens/Hunt';
import { Bench } from './screens/Bench';
import { Diary } from './screens/Diary';
import { Lab } from './screens/Lab';
import { Reader } from './screens/Reader';
import { Intro } from './screens/Intro';
import { Settings } from './screens/Settings';
import { SoulPage } from './screens/SoulPage';
import { Talk } from './screens/Talk';
import { Together } from './screens/Together';
import { Unsupported } from './screens/Unsupported';
import { Wake } from './screens/Wake';
import { Waking } from './screens/Waking';
import { Welcome } from './screens/Welcome';
import { loadSettings, saveSettings } from './store/settings';
import { importPocSouls, loadSouls } from './store/souls';

type Boot =
  | { state: 'starting' }
  | { state: 'ready'; supported: boolean; onboarded: boolean }
  | { state: 'failed'; message: string };

// Read before anything else runs, so this visit's own markers never count.
const interrupted = takeInterruptedActivities();

export function App() {
  const route = useRoute();
  useT();
  const [boot, setBoot] = useState<Boot>({ state: 'starting' });
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    (async () => {
      const [device, settings] = await Promise.all([initEngine(), loadSettings()]);
      setLang(settings.lang);
      setModel(modelByKey(settings.model));
      await importPocSouls();
      await loadSouls();
      // Onboarded means the model is on this device; if its files were deleted, the first-run screen
      // asks before downloading them again.
      const onboarded = settings.onboarded && device.webgpu && (await llmIsCached());
      setBoot({ state: 'ready', supported: device.webgpu, onboarded });
      // A returning visitor's model is cached: start loading it now, before the camera, so waking is quick.
      if (onboarded) ensureLlm().catch(() => undefined);
    })().catch((e: Error) => setBoot({ state: 'failed', message: e.message }));
  }, []);

  // iOS allows speech only after a user gesture: the first tap anywhere unlocks it.
  useEffect(() => {
    const unlock = () => unlockSpeech();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  if (boot.state === 'starting') return <main className="screen" aria-busy="true" />;
  if (boot.state === 'failed')
    return (
      <main className="screen">
        <h1>{t('Something went wrong')}</h1>
        <p className="notice notice--error" role="alert">
          Hearthwake could not open its storage ({boot.message}). Private browsing can block it: try a normal
          tab.
        </p>
      </main>
    );
  if (!boot.supported) return <Unsupported />;
  if (!boot.onboarded && !introDone) return <Intro onDone={() => setIntroDone(true)} />;
  if (!boot.onboarded)
    return (
      <Welcome
        onDone={() => {
          void saveSettings({ onboarded: true });
          setBoot({ ...boot, onboarded: true });
          navigate({ name: 'home' }, { replace: true });
        }}
      />
    );

  switch (route.name) {
    case 'wake':
      return <Wake />;
    case 'describe':
      return <Describe />;
    case 'waking':
      return <Waking />;
    case 'talk':
      return <Talk key={route.id} id={route.id} />;
    case 'soul':
      return <SoulPage key={route.id} id={route.id} />;
    case 'settings':
      return <Settings />;
    case 'together':
      return <Together />;
    case 'hunt':
      return <Hunt />;
    case 'lab':
      return <Lab />;
    case 'bench':
      return <Bench />;
    case 'diary':
      return <Diary />;
    case 'reader':
      return <Reader />;
    case 'about':
      return <Intro doneLabel={t('Done')} onDone={() => goBack({ name: 'home' })} />;
    default:
      return <Home interrupted={interrupted} />;
  }
}
