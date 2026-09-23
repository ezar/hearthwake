# 0003. Waking and talking require WebGPU

Status: accepted, M0. Applies to M1 unless M0 results force a change.

## Context

The spec asked for a WASM fallback for every model, and also for the LLM to run on WebLLM. WebLLM only runs on WebGPU; it has no WASM backend. The detector, the vision model and Whisper (transformers.js) do fall back to WASM.

Options considered:

1. transformers.js `text-generation` with an ONNX build of Qwen2.5 0.5B Instruct on WASM. Same library as the other models, but single-threaded on GitHub Pages (no cross-origin isolation), so replies would likely miss the latency targets by a wide margin.
2. wllama (llama.cpp compiled to WASM) with a GGUF build. Faster on WASM, but a second LLM runtime to maintain and test.
3. Require WebGPU for waking and talking.

## Decision

Option 3. Devices without WebGPU are unsupported for waking and talking. The LLM is the one model exempt from the WASM fallback rule.

In the spike, when the probe finds no WebGPU, the LLM picker and Load button stay disabled and the LLM status says so. The probe, detection, vision and transcription still run on WASM, so those devices can still be measured.

## Consequences

- One LLM runtime (WebLLM) to maintain.
- The product needs a clear "this device can't wake things up" message in M1, driven by the same probe.
- If M0 shows that WebGPU does not work on the target iPhones, this decision must be revisited, with option 2 as the first alternative.
