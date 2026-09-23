// Capability probe: WebGPU, fp16 shaders, storage and speech voices.
export async function probeDevice() {
  const info = {
    userAgent: navigator.userAgent,
    cores: navigator.hardwareConcurrency ?? null,
    deviceMemoryGB: navigator.deviceMemory ?? null,
    crossOriginIsolated: self.crossOriginIsolated,
    webgpu: false,
    shaderF16: false,
  };

  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      info.storageQuotaMB = Math.round(est.quota / 1e6);
      info.storageUsedMB = Math.round(est.usage / 1e6);
      info.storagePersisted = await navigator.storage.persist?.();
    } catch (e) {
      info.storageError = String(e);
    }
  }

  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        info.webgpu = true;
        info.shaderF16 = adapter.features.has('shader-f16');
        const a = adapter.info ?? {};
        info.gpu = { vendor: a.vendor, architecture: a.architecture, description: a.description };
        info.limitsMB = {
          maxBufferSize: Math.round(adapter.limits.maxBufferSize / 1048576),
          maxStorageBufferBindingSize: Math.round(adapter.limits.maxStorageBufferBindingSize / 1048576),
        };
      }
    } catch (e) {
      info.webgpuError = String(e);
    }
  }

  info.mediaRecorderTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
    .filter(t => self.MediaRecorder?.isTypeSupported?.(t));
  return info;
}
