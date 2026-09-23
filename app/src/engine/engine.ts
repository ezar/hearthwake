// The app's single engine: one LLM and one classifier for the whole visit, loaded LLM first while memory is
// cleanest (ADR 0016), with a status the UI can watch.
import { useSyncExternalStore } from 'react';
import { probeDevice, type DeviceInfo } from './device';
import { isModelCached, webLlmBackend, type LlmBackend } from './llm';
import { log, timed, withActivity } from './metrics';
import { mockLlm, mockRequested, mockVision } from './mock';
import { mediaPipeVision, type VisionBackend } from './vision';

export type LlmStatus =
  | { state: 'idle' }
  | { state: 'loading'; progress: number; text: string }
  | { state: 'ready' }
  | { state: 'error'; message: string };

export interface EngineState {
  device: DeviceInfo | null;
  mock: boolean;
  llm: LlmStatus;
}

let state: EngineState = { device: null, mock: false, llm: { state: 'idle' } };
const listeners = new Set<() => void>();

function set(patch: Partial<EngineState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useEngine = () => useSyncExternalStore(subscribe, () => state);
export const engineState = () => state;

let llm: LlmBackend | null = null;
let llmLoading: Promise<LlmBackend> | null = null;
let vision: VisionBackend | null = null;
let visionLoading: Promise<VisionBackend> | null = null;

export async function initEngine(): Promise<DeviceInfo> {
  const mock = mockRequested();
  if (mock) sessionStorage.setItem('hearthwake.mock', '1');
  const device = await probeDevice();
  // The mock engine runs anywhere; it stands in for WebGPU so the UI can be tested.
  set({ device: mock ? { ...device, webgpu: true } : device, mock });
  return state.device!;
}

// Loads the LLM once; later calls share the same promise. A failed load can be retried.
export function ensureLlm(): Promise<LlmBackend> {
  llmLoading ??= (async () => {
    const backend = state.mock ? mockLlm() : webLlmBackend(state.device?.shaderF16 ?? false);
    set({ llm: { state: 'loading', progress: 0, text: 'Starting' } });
    try {
      await withActivity('load the model', () =>
        timed('load.llm', () =>
          backend.load((progress, text) => set({ llm: { state: 'loading', progress, text } })),
        ),
      );
    } catch (e) {
      llmLoading = null;
      const message = (e as Error).message || 'The model could not load';
      log(`LLM load failed: ${message}`);
      set({ llm: { state: 'error', message } });
      throw e;
    }
    llm = backend;
    set({ llm: { state: 'ready' } });
    return backend;
  })();
  return llmLoading;
}

export const loadedLlm = () => llm;

export function ensureVision(): Promise<VisionBackend> {
  visionLoading ??= (async () => {
    const backend = state.mock ? mockVision() : mediaPipeVision();
    try {
      await timed('load.vision', () => backend.load());
    } catch (e) {
      visionLoading = null;
      throw e;
    }
    vision = backend;
    return backend;
  })();
  return visionLoading;
}

export const loadedVision = () => vision;

// True when the LLM can load without a download (the mock engine never downloads).
export async function llmIsCached(): Promise<boolean> {
  return state.mock || isModelCached(state.device?.shaderF16 ?? false);
}
