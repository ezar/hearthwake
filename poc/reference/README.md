# Hearthwake PoC (M0)

Feasibility spike for Hearthwake: can an iPhone wake up a household object and hold a spoken conversation with it, entirely in the browser?

It tests the critical loop end to end:

1. Device probe: WebGPU, fp16 shaders, storage quota, recorder formats.
2. Live object detection on the camera (YOLOS tiny, COCO classes).
3. Waking a thing: crop, describe it with SmolVLM 256M, create its soul with an on-device LLM (WebLLM, JSON schema output).
4. Talking to it: push-to-talk, Whisper transcription, streamed LLM reply, sentence-by-sentence speech with system voices.
5. Memory: souls and conversations persist in localStorage; older turns are compacted into a memory summary.
6. Report: every timing is collected and can be copied as JSON for `docs/models.md`.

No build step. Plain ES modules; libraries and models load from CDNs and Hugging Face, then stay cached in the browser.

## Run it

Camera and microphone need HTTPS, so the simplest path is GitHub Pages:

1. Put this folder in the `hearthwake` repo as `poc/` (or in its own repo).
2. Enable GitHub Pages for the branch.
3. Open `https://ezar.github.io/hearthwake/poc/` on the iPhone.

For desktop testing, any static server on localhost works (`npx serve .`).

## Test protocol

Do each run on the iPhone (Safari), then repeat on the Windows desktop (Chrome) for comparison.

1. Tap Iniciar. Check `webgpu` and `shaderF16` in the probe output.
2. Load models one at a time, in this order: detector, vision, LLM, hearing. Note if Safari reloads the page at any step; that means it ran out of memory. If it does, retry with the smaller LLM and whisper-tiny.
3. Open the camera, start detection, point at the kitchen and the living room. Note fps.
4. Wake at least three different objects, including one the detector does not know (use "Usar el centro" on a lamp or a plush toy).
5. Hold a short conversation with each (5 or 6 turns), speaking in Spanish.
6. Close the tab. Next day, reopen, pick a soul from the list and ask what it remembers.
7. Copy the report after each device session.

## Questions M0 must answer

- Does WebGPU work on the iPhone, and with fp16 shaders?
- Can the detector, the VLM, the LLM and Whisper be loaded at the same time on the iPhone, or do we need to swap models?
- Time to first audio after releasing the talk button (target under 4 s on iPhone).
- Time to wake a thing (target under 12 s on iPhone).
- Which LLM size gives souls with real personality in Spanish without breaking memory or latency?
- Are the system Spanish voices varied enough, or do we need a neural TTS with Spanish support?
- Is SmolVLM's description concrete enough to make greetings feel personal?

## Known limits of this spike

- Speech uses the system voices (Web Speech API). Kokoro, planned in the spec, has no reliable Spanish support in kokoro-js, so neural TTS is an open question for M1.
- Gemma and Qwen3 builds are excluded from the LLM list: Gemma's template rejects system prompts and Qwen3 emits thinking tokens.
- No PWA, no IndexedDB, no WebXR. Those start in M1.
- transformers.js is loaded as `@3` from jsDelivr; pin the exact version once M0 settles.
