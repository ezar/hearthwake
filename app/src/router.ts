// Hash routes, so the app works from GitHub Pages without server rewrites and the back button just works.
import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'welcome' }
  | { name: 'wake' }
  | { name: 'describe' }
  | { name: 'waking' }
  | { name: 'talk'; id: string }
  | { name: 'soul'; id: string }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'together' }
  | { name: 'hunt' };

export function parseRoute(hash: string): Route {
  const [, first = '', second = ''] = hash.replace(/^#/, '').split('/');
  const id = decodeURIComponent(second);
  switch (first) {
    case 'welcome':
    case 'wake':
    case 'describe':
    case 'waking':
    case 'settings':
    case 'about':
    case 'together':
    case 'hunt':
      return { name: first };
    case 'talk':
    case 'soul':
      return id ? { name: first, id } : { name: 'home' };
    default:
      return { name: 'home' };
  }
}

export function routeHash(route: Route): string {
  return 'id' in route
    ? `#/${route.name}/${encodeURIComponent(route.id)}`
    : `#/${route.name === 'home' ? '' : route.name}`;
}

// Replace keeps transient screens (waking up) out of the history, so Back skips them.
export function navigate(route: Route, { replace = false } = {}): void {
  const hash = routeHash(route);
  // Entries pushed here are marked, so Back buttons know whether there is an in-app screen to return to.
  if (replace) history.replaceState(history.state, '', hash);
  else history.pushState({ hearthwake: true }, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parseRoute(hash);
}

// Back goes to the previous in-app screen when there is one, else to the given route.
export function goBack(fallback: Route): void {
  if ((history.state as { hearthwake?: boolean } | null)?.hearthwake) history.back();
  else navigate(fallback, { replace: true });
}
