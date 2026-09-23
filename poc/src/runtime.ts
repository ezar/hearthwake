// Device flags set by the probe; every model loader reads them.
export type Device = 'webgpu' | 'wasm';

export const runtime: { device: Device; f16: boolean } = { device: 'wasm', f16: false };
