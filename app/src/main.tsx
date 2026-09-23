import '@fontsource-variable/figtree';
import '@fontsource-variable/fraunces';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);

// The service worker keeps the app shell available offline; development serves fresh files instead.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL;
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => undefined);
}
