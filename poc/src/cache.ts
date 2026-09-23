// Downloaded model weights live in Cache Storage (transformers.js: `transformers-cache`, WebLLM:
// `webllm/model`, `webllm/config`, `webllm/wasm`). The harness keeps nothing else there: souls and the
// log are in localStorage, so clearing every cache of the origin frees models only.

export async function storageUsageMB(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    return est?.usage === undefined ? null : Math.round(est.usage / 1048576);
  } catch {
    return null;
  }
}

// Deletes every cache and IndexedDB database of the origin; returns what was deleted.
export async function clearModelCaches(): Promise<string[]> {
  const deleted: string[] = [];
  if (self.caches) {
    for (const name of await caches.keys()) {
      if (await caches.delete(name)) deleted.push(name);
    }
  }
  // WebLLM can be configured to cache in IndexedDB instead; the harness does not, but clear it anyway.
  const dbs = (await indexedDB.databases?.().catch(() => [])) ?? [];
  for (const { name } of dbs) {
    if (!name) continue;
    await new Promise<void>(resolve => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
    deleted.push(`indexedDB:${name}`);
  }
  return deleted;
}
