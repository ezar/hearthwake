// What this browser can do: WebGPU (required for the LLM), fp16 shaders, speech recognition, storage.
export interface DeviceInfo {
  webgpu: boolean;
  shaderF16: boolean;
  speechRecognition: boolean;
  speechSynthesis: boolean;
  camera: boolean;
  storage: { quotaMB: number; usageMB: number } | null;
  userAgent: string;
}

const toMB = (bytes: number) => Math.round(bytes / 1048576);

export async function probeDevice(): Promise<DeviceInfo> {
  const info: DeviceInfo = {
    webgpu: false,
    shaderF16: false,
    speechRecognition: 'SpeechRecognition' in self || 'webkitSpeechRecognition' in self,
    speechSynthesis: 'speechSynthesis' in self,
    camera: !!navigator.mediaDevices?.getUserMedia,
    storage: null,
    userAgent: navigator.userAgent,
  };
  try {
    const est = await navigator.storage?.estimate?.();
    if (est) info.storage = { quotaMB: toMB(est.quota ?? 0), usageMB: toMB(est.usage ?? 0) };
  } catch {
    // Unknown storage is not a blocker.
  }
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (adapter) {
      info.webgpu = true;
      info.shaderF16 = adapter.features.has('shader-f16');
    }
  } catch {
    // No WebGPU.
  }
  return info;
}

// Ask the browser not to evict downloaded models and souls under storage pressure.
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageUsageMB(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    return est?.usage === undefined ? null : toMB(est.usage);
  } catch {
    return null;
  }
}

// Deletes the downloaded model files (Cache Storage). Souls live in IndexedDB and are kept.
export async function clearModelCaches(): Promise<number> {
  if (!self.caches) return 0;
  let deleted = 0;
  for (const name of await caches.keys()) {
    if (name.startsWith('hearthwake-shell')) continue;
    if (await caches.delete(name)) deleted++;
  }
  return deleted;
}
