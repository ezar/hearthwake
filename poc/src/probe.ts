// Capability probe: WebGPU, fp16 shaders, storage and recorder formats.
export const RECORDER_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

export interface ProbeResult {
  userAgent: string;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  crossOriginIsolated: boolean;
  storage: { quotaMB: number; usageMB: number; persisted: boolean } | { error: string } | null;
  webgpu: boolean;
  shaderF16: boolean;
  gpu: { vendor: string; architecture: string; description: string } | null;
  limitsMB: { maxBufferSize: number; maxStorageBufferBindingSize: number } | null;
  webgpuError?: string;
  mediaRecorderTypes: string[];
  // Built-in browser AI, if any: an on-device LLM (the Prompt API's LanguageModel) and speech recognition.
  builtIn: { languageModel: boolean; speechRecognition: boolean };
}

const toMB = (bytes: number) => Math.round(bytes / 1048576);

export async function probeDevice(): Promise<ProbeResult> {
  const info: ProbeResult = {
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    // deviceMemory is Chromium only; Safari has no equivalent.
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    crossOriginIsolated: self.crossOriginIsolated,
    storage: null,
    webgpu: false,
    shaderF16: false,
    gpu: null,
    limitsMB: null,
    mediaRecorderTypes: RECORDER_TYPES.filter(t => self.MediaRecorder?.isTypeSupported?.(t)),
    builtIn: {
      languageModel: 'LanguageModel' in self,
      speechRecognition: 'SpeechRecognition' in self || 'webkitSpeechRecognition' in self,
    },
  };

  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const persisted = (await navigator.storage.persist?.()) ?? false;
      info.storage = { quotaMB: toMB(est.quota ?? 0), usageMB: toMB(est.usage ?? 0), persisted };
    } catch (e) {
      info.storage = { error: String(e) };
    }
  }

  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        info.webgpu = true;
        info.shaderF16 = adapter.features.has('shader-f16');
        const a = adapter.info;
        info.gpu = {
          vendor: a?.vendor ?? '',
          architecture: a?.architecture ?? '',
          description: a?.description ?? '',
        };
        info.limitsMB = {
          maxBufferSize: toMB(adapter.limits.maxBufferSize),
          maxStorageBufferBindingSize: toMB(adapter.limits.maxStorageBufferBindingSize),
        };
      }
    } catch (e) {
      info.webgpuError = String(e);
    }
  }
  return info;
}
