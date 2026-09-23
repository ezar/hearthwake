# Hearthwake M0: feasibility spike

> Amended during M0 by the ADRs in `docs/decisions/`. Notably, ADR 0012 switches souls and UI to English: where this spec says Spanish, read English.

This document tells Claude Code how to build milestone M0 of Hearthwake. The full product spec lives in `docs/spec.md`; read it first for context, but build only what is described here.

M0 answers one question: can an iPhone, inside Safari, wake up a household object and hold a spoken conversation with it, with every AI model running locally in the browser?

---

## 0. Working rules

- Put this file in the repo as `docs/m0-spike.md` and reference it from `CLAUDE.md`.
- All code, comments, identifiers, commit messages and docs in English. UI strings in Spanish (this is a test harness for a Spanish-speaking family; i18n arrives in M1).
- A reference implementation may exist in `poc/reference/` (plain ES modules, no build). Use it as a guide for API usage and decisions, not as code to copy blindly. Where this spec and the reference disagree, this spec wins.
- When a library or model does not behave as described here, stop, explain what you found and propose options. Record every decision as a short ADR in `docs/decisions/`.
- Do not add features outside this document. No React, no PWA, no IndexedDB, no WebXR, no game logic. Those start in M1.

---

## 1. Scope

The spike is a single-page test harness with five areas, in this order on the page:

1. **Device**: capability probe.
2. **Models**: load and unload each model independently, with status and timings.
3. **Camera**: live object detection with a tappable overlay.
4. **Soul**: wake a selected object, then talk to it by voice or text.
5. **Report**: on-screen log and a button that copies a JSON report with every timing.

---

## 2. Target devices and constraints

- Primary: iPhone, Safari. Secondary: Windows desktop, Chrome. Tertiary: Android, Chrome.
- On iOS every browser, Chrome included, uses WebKit. There is no WebXR on iOS; do not use it anywhere.
- HTTPS is required for camera and microphone. Deploy target is GitHub Pages, which cannot set COOP/COEP headers, so the page is not cross-origin isolated and WASM runs single-threaded. Do not rely on SharedArrayBuffer.
- Every model must have a WASM fallback when WebGPU is missing, except the LLM: waking and talking require WebGPU (ADR 0003).
- Libraries load from npm through Vite; model weights download from Hugging Face and the MLC CDN on first use and are cached by the libraries in Cache Storage.

---

## 3. Stack and structure

- Vite + TypeScript (strict), vanilla DOM. No UI framework.
- `@huggingface/transformers` v3 (pin the exact version after the first successful run on iPhone).
- `@mlc-ai/web-llm` 0.2.x.
- ESLint + Prettier. Vitest for the pure logic (sentence splitter, JSON repair, memory compaction trigger, report stats).
- GitHub Actions: typecheck, lint, test, build, deploy to GitHub Pages under `/hearthwake/poc/` (set Vite `base` accordingly).

```
poc/
  index.html
  src/
    main.ts          UI wiring, busy state, button enablement
    runtime.ts       device flags (webgpu | wasm, fp16) set by the probe
    probe.ts         capability probe
    report.ts        log, timings, JSON report
    camera.ts        camera, detection loop, overlay, selection, crop
    vlm.ts           object description
    llm.ts           model list, load, soul creation, chat, memory compaction
    voice.ts         recording, transcription, speech synthesis, sentence splitter
    souls.ts         persistence of souls
    styles.css
  tests/
docs/
  m0-spike.md
  models.md          results table per device (filled after testing)
  decisions/
```

Heavy inference may stay on the main thread in M0 if it keeps the code simple, but note in `docs/models.md` whether the UI freezes noticeably during each call. Moving work to Web Workers is an M1 task unless the freezes make the spike unusable.

---

## 4. Device probe

Runs when the user taps "Iniciar" (this tap is also the user gesture that unlocks speech synthesis on iOS). Collect and display as JSON:

- User agent, `hardwareConcurrency`, `deviceMemory` (absent on Safari, store null).
- `crossOriginIsolated`.
- Storage quota and usage; request persistent storage.
- WebGPU: adapter available, `shader-f16` feature, adapter info (vendor, architecture, description), `maxBufferSize` and `maxStorageBufferBindingSize` in MB.
- Supported MediaRecorder audio types among `audio/mp4`, `audio/webm;codecs=opus`, `audio/webm`.
- Count of Spanish system voices (voices load asynchronously; log the count shortly after).

Set `runtime.device` to `webgpu` or `wasm` and `runtime.f16` from the probe. Every loader reads these flags.

---

## 5. Models

> Amended by ADRs 0008 and 0009 after the first iPhone runs: models load in phases by default, the default LLM is Llama 3.2 1B, Gemma 3 1B is allowed, hearing defaults to whisper-tiny, and the detector is optional. ADR 0010 makes the detector selectable (MediaPipe EfficientDet-Lite0 on WebGL by default, or YOLOS tiny), each on GPU or CPU.

Each model has Load and Free buttons, a status line and a load timing. Models are loaded one at a time on purpose: if Safari reloads the page, it ran out of memory, and that is a result we need to record.

- **Detector**: `Xenova/yolos-tiny` via the transformers.js `object-detection` pipeline. dtype `fp32` on WebGPU, `q8` on WASM. Apache 2.0. Do not use Ultralytics YOLO models (AGPL).
- **Vision**: `HuggingFaceTB/SmolVLM-256M-Instruct` via `AutoProcessor` and `AutoModelForVision2Seq`. On WebGPU use dtype `{ embed_tokens: fp16 or fp32 depending on runtime.f16, vision_encoder: 'q4', decoder_model_merged: 'q4' }`; on WASM `q8`.
- **LLM**: WebLLM. Populate a picker from `prebuiltAppConfig.model_list`, filtered to Qwen2.5 (0.5B, 1.5B, 3B) and Llama 3.2 (1B, 3B) instruct builds, choosing `q4f16_1-MLC` builds when `runtime.f16` is true and `q4f32_1-MLC` otherwise. Show each model's `vram_required_MB`. Default to Qwen2.5 1.5B. Exclude Gemma (its chat template rejects system prompts) and Qwen3 (emits thinking tokens). Show WebLLM's init progress text in the status line. Switching model reuses the engine with `reload`.
- **Hearing**: Whisper via the transcription pipeline, picker with `onnx-community/whisper-tiny` and `onnx-community/whisper-base` (default base). On WebGPU dtype `{ encoder_model: 'fp32', decoder_model_merged: 'q4' }`; on WASM `q8`.
- **Voice**: system voices through the Web Speech API. No download. Kokoro was considered, but kokoro-js has no reliable Spanish support; neural Spanish TTS is an open question for M1.

Free must actually release memory (`dispose()` for transformers.js models, `unload()` for WebLLM).

---

## 6. Camera and detection

- Rear camera via `getUserMedia`, ideal 1280x720, `playsinline` and muted video.
- Show the video at its natural aspect ratio (no `object-fit: cover`) so detection boxes in percentages map directly onto an overlay canvas sized to the video's client size times `devicePixelRatio`.
- Detection loop while enabled: draw the frame into a 320 px wide canvas, build a `RawImage` from its RGBA pixels converted to RGB, run the detector with threshold 0.6 and percentage boxes, draw, then yield one animation frame. Report fps, average ms per frame and object count once per second. Record per-frame timings silently (not in the visible log).
- Overlay: rounded boxes with a label and confidence. The selected box is drawn in lamp amber with a glow.
- Tapping the overlay selects the smallest box containing the tap point.
- Selection tracking: after each detection, move the selection to the nearest box with the same label if its centre moved less than 0.2 (normalized); otherwise keep the last known box.
- "Usar el centro" button: selects a fixed central region labeled `objeto`, for things the detector does not know (lamp, plush toy, washing machine). This tests the open-vocabulary path.
- Crop: take the selected box from the full-resolution video with 6% padding, scaled so the longest side is at most 384 px.

---

## 7. Waking a thing

Enabled when there is a selection and both Vision and LLM are loaded. Steps, each timed:

1. Crop the selection.
2. `wake.describe`: SmolVLM describes it (prompt in English: what it is, colours, materials, condition, stickers or marks, two or three sentences; max 120 new tokens, greedy).
3. `wake.createSoul`: the LLM generates the soul as JSON, using WebLLM `response_format` with a JSON schema. Fields: `name`, `title`, `archetype`, `traits` (3 to 5), `style`, `catchphrase`, `secret`, `pitch`, `rate`, `greeting`. Prompt in Spanish; the greeting must mention something concrete about the object's appearance. Parse defensively: try `JSON.parse`, then extract the first `{...}` block, then fail with a clear error. Clamp `pitch` to 0.6..1.6 and `rate` to 0.8..1.2.
4. Save the soul with id, detector label, VLM description, a JPEG thumbnail as data URL, empty memory, history containing the greeting, and creation time.
5. `wake.total`, then show the soul card and speak the greeting.

The soul card shows the thumbnail in a circle with an amber glow, name, title, archetype, traits, catchphrase, and a collapsible "Qué recuerda" with the memory summary. A short wake animation plays unless reduced motion is requested.

---

## 8. Talking

- Push-to-talk button: pointer down starts recording, pointer up or cancel stops it. Use pointer capture, `touch-action: none`, no text selection and no context menu so iOS does not interfere with the hold. Starting to record cancels any ongoing speech.
- Recording: MediaRecorder with the first supported type from the probe list, microphone with echo cancellation and noise suppression. The mic stream is requested once and reused.
- Transcription (`stt.transcribe`): decode the blob with `AudioContext.decodeAudioData`, resample to mono 16 kHz with an `OfflineAudioContext`, skip clips under 0.4 s, run Whisper with language Spanish and task transcribe.
- A text input with a Send button offers the same flow without voice, for desktop testing.
- Reply: stream the LLM answer. System prompt in Spanish with the soul's identity, appearance, archetype, traits, style, catchphrase, secret, memory summary and these rules: answer in the player's language, 1 to 3 short sentences, no emojis or stage directions; playful and allowed to be grumpy or dramatic but never cruel or frightening; never ask for personal data or propose secrets from parents; never suggest touching sockets, fire or hot things, or climbing. Temperature 0.8, max 160 tokens.
- Include the last 8 history messages, dropping leading assistant messages so a user turn always follows the system prompt.
- Speak sentence by sentence: a sentence splitter emits a sentence only when its terminal punctuation (`.`, `!`, `?`, `…`) is followed by whitespace, and flushes the remainder at the end. Each sentence is queued as a separate utterance with the soul's voice, pitch and rate.
- Voice selection: pick a Spanish system voice deterministically from a hash of the soul's name; fall back to `es-ES` if none.
- Timings: `llm.firstToken`, `llm.fullReply`, `talk.firstAudioFromText` (from sending the text to the first utterance starting) and `talk.firstAudioFromRelease` (from releasing the talk button). The last one is the headline metric.

---

## 9. Memory and persistence

- Souls persist in `localStorage` under `hearthwake.poc.souls` as a map by id. Handle quota errors without crashing.
- After each exchange, append the user and assistant messages to the soul's history.
- When history exceeds 16 messages, run `memory.compact`: the LLM summarizes everything except the last 6 messages, merged with the previous memory, into 3 to 5 factual sentences in Spanish and third person. Keep the last 6 messages.
- A picker lists saved souls (name and object). Choosing one restores its card and transcript. "Olvidar" deletes it after confirmation.

---

## 10. Report

- On-screen log with timestamps, last 200 lines, auto-scroll. Unhandled errors and promise rejections are logged too.
- Every timed step stores its duration; the report summarizes each metric as count, median, min and max.
- "Copiar informe" copies JSON with: timestamp, probe result, loaded models, timing summary and the last 120 log lines. If the clipboard is unavailable, show the JSON in the log area.

---

## 11. UI

- Mobile-first, one column, max width 720 px, safe-area padding for the notch, sticky header with the title and the Iniciar button.
- Palette: night indigo background, a slightly lighter indigo for panels, lamp amber for primary actions and awakened things, moss green for the talk button and success states, soft red for recording and errors. Rounded display face (for example Baloo 2 from Google Fonts) for headings only; system font for the rest.
- Buttons at least 44 px tall; the talk button at least 72 px. Visible focus rings. Respect reduced motion.
- A single `busy` flag disables actions while a model loads or a request runs; button enablement is computed in one function from state (probe done, models loaded, selection present, soul present, busy).
- Copy is short and practical, in Spanish, describing what happens ("Despertar objeto", "Mantén pulsado para hablar", "Escuchando… suelta para enviar").

---

## 12. Tests

- Unit tests (Vitest) for: sentence splitter (partial sentences, ellipsis, multiple punctuation, flush), JSON parsing and repair, value clamping, history trimming rule (no leading assistant), compaction trigger and result shape with a mocked engine, report statistics.
- No automated tests for models or camera in M0. Manual test protocol below.

---

## 13. Manual test protocol

Run on the iPhone first, then on the Windows desktop.

1. Tap Iniciar and check `webgpu` and `shaderF16`.
2. Load models one by one: detector, vision, LLM, hearing. Record whether Safari reloads at any step. If it does, retry with Qwen2.5 0.5B or Llama 3.2 1B and whisper-tiny, and test whether freeing the detector and vision after waking makes room for the rest.
3. Open the camera, start detection in the kitchen and the living room, note fps.
4. Wake at least three objects, one of them through "Usar el centro".
5. Talk with each for 5 or 6 turns in Spanish, by voice.
6. Next day, reopen, pick a soul and ask what it remembers.
7. Copy the report after each device session and paste the key figures into `docs/models.md`.

---

## 14. Acceptance criteria

M0 is done when `docs/models.md` answers each of these with measured data from the iPhone and the desktop:

- Does WebGPU work on the iPhone, with or without fp16 shaders?
- Can detector, vision, LLM and Whisper coexist in memory on the iPhone, or which combination must be swapped?
- Median time to first audio after releasing the talk button (target under 4 s on iPhone, under 2.5 s on desktop).
- Median time to wake a thing (target under 12 s on iPhone).
- Detection fps on the iPhone (target 5 fps or more).
- Which LLM size gives souls with a distinct personality in Spanish while meeting the latency targets.
- Whether SmolVLM's descriptions are concrete enough for personal greetings.
- Whether system Spanish voices are varied enough, and a recommendation for neural TTS in M1.
- A soul remembers a fact from a conversation held on a previous day.

Finish M0 with an ADR that fixes the model set and tiers for M1, or explains why the Lite tier needs a different approach.
