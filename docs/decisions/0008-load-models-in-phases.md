# 0008. Load models in phases

Status: accepted, M0.

## Context

On the iPhone (iOS 27.2, Safari, 1024 MB `maxBufferSize`), Llama-3.2-1B loads alone. The tab is killed when whisper-base loads next to it, and when the LLM loads with the detector and vision already in memory. Smaller LLMs barely help: the smallest ones with usable Spanish need 700 to 950 MB (docs/models.md). The spec's loop assumed all four models could stay loaded.

## Decision

- A "Cargar por fases" option, on by default, keeps only what the current step needs:
  - Waking frees the detector and hearing, loads vision if needed, describes the object, frees vision, then creates the soul with the LLM.
  - After the greeting, hearing is loaded again for talking.
  - The LLM stays loaded throughout.
- With the option off, waking behaves as before (vision must be loaded by hand and nothing is freed), so both setups can be measured.
- The detector is optional. "Usar el centro" works without it.
- The detector can run on the CPU (WASM, `q8`) instead of WebGPU. Safari was killed as soon as detection started, and this tells a WebGPU problem apart from a memory one.
- Hearing defaults to whisper-tiny.
- The detection loop leaves its own crash marker while it runs. Markers now hold every activity running at once, so a crash during detection plus a load reports both.

## Consequences

- `wake.total` now includes loading and freeing vision. Loads from cache took under a second on the iPhone. The individual `load.*` timings are still recorded.
- After waking, the talk button waits for hearing to load.
- Waking another object with the detector requires loading the detector again.
