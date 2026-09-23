// Shared MediaPipe Tasks plumbing: the WASM runtime served from this site, and model files kept in Cache
// Storage so "Delete downloaded models" clears them with the rest.
const MODEL_CACHE = 'mediapipe-models';

export async function visionFileset(): Promise<{ wasmLoaderPath: string; wasmBinaryPath: string }> {
  const [{ default: wasmLoaderPath }, { default: wasmBinaryPath }] = await Promise.all([
    import('@mediapipe/tasks-vision/vision_wasm_internal.js?url'),
    import('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'),
  ]);
  return { wasmLoaderPath, wasmBinaryPath };
}

export async function fetchModel(url: string): Promise<Uint8Array> {
  const cache = await caches.open(MODEL_CACHE);
  let response = await cache.match(url);
  if (!response) {
    const fresh = await fetch(url);
    if (!fresh.ok) throw new Error(`Could not download ${url.split('/').pop()} (${fresh.status})`);
    await cache.put(url, fresh.clone());
    response = fresh;
  }
  return new Uint8Array(await response.arrayBuffer());
}
