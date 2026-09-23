// Startup, the first-run gate and the screen for the current route.
import { useEffect, useState } from 'react';
import { ensureLlm, initEngine, llmIsCached } from './engine/engine';
import { takeInterruptedActivities } from './engine/metrics';
import { unlockSpeech } from './engine/voice';
import { navigate, useRoute } from './router';
import { Describe } from './screens/Describe';
import { Home } from './screens/Home';
import { Settings } from './screens/Settings';
import { SoulPage } from './screens/SoulPage';
import { Talk } from './screens/Talk';
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
  const [boot, setBoot] = useState<Boot>({ state: 'starting' });

  useEffect(() => {
    (async () => {
      const [device, settings] = await Promise.all([initEngine(), loadSettings()]);
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
        <h1>Something went wrong</h1>
        <p className="notice notice--error" role="alert">
          Hearthwake could not open its storage ({boot.message}). Private browsing can block it: try a normal
          tab.
        </p>
      </main>
    );
  if (!boot.supported) return <Unsupported />;
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
    default:
      return <Home interrupted={interrupted} />;
  }
}
