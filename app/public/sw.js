// Keeps the app shell available offline. Pages load network first and fall back to the cached copy;
// hashed assets are served from the cache once fetched. Model weights are cached by WebLLM and
// MediaPipe themselves (other origins), and the M0 spike under ./poc/ is left alone.
const SHELL = 'hearthwake-shell-v1';
const scope = new URL(self.registration.scope);

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then(cache => cache.addAll(['./', './manifest.webmanifest', './icon.svg']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => k.startsWith('hearthwake-shell') && k !== SHELL).map(k => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname))
    return;
  if (url.pathname.startsWith(`${scope.pathname}poc/`)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          void caches.open(SHELL).then(cache => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./').then(cached => cached ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      cached =>
        cached ??
        fetch(request).then(response => {
          if (response.ok && url.pathname.includes('/assets/')) {
            const copy = response.clone();
            void caches.open(SHELL).then(cache => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
