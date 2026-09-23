# 0003. The LLM has no WASM fallback in M0

Status: open, needs a call before M1.

## Context

The spec says every model must have a WASM fallback when WebGPU is missing, and also that the LLM runs on WebLLM. WebLLM only runs on WebGPU; it has no WASM backend. The detector, the vision model and Whisper (transformers.js) do fall back to WASM.

## Decision for M0

When the probe finds no WebGPU, the LLM Load button fails with a clear message (`WebLLM necesita WebGPU…`) instead of crashing inside WebLLM. Everything else still runs, so the probe, detection and transcription can be measured on such devices.

## Options for M1

1. transformers.js `text-generation` with an ONNX build of Qwen2.5 0.5B Instruct on WASM. Same library as the other models; single-threaded on GitHub Pages, so likely slow.
2. wllama (llama.cpp compiled to WASM) with a GGUF build. Mature and fast for WASM, but a second runtime to maintain.
3. Require WebGPU for talking and treat devices without it as unsupported.

M0 results on the iPhone (does WebGPU work at all?) decide which one is worth trying.
