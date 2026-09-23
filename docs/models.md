# M0 results

Fill in from the copied reports (`Copiar informe`) after each device session. Timings are medians in ms unless noted; add min and max where they vary a lot. See `docs/m0-spike.md` section 13 for the protocol and section 14 for what each answer needs.

## Devices

| Device | OS / browser | webgpu | shaderF16 | maxBufferSize MB | Storage quota MB |
| --- | --- | --- | --- | --- | --- |
| iPhone (4 cores) | iOS 27.2: Edge 153 and Safari 27.2 (both WebKit) | yes | yes | 1024 | 39322 |
| Windows desktop | | | | | |
| Android (optional) | | | | | |

## Model loads

| Model | iPhone load ms | Page reload on iPhone? | Desktop load ms | UI freezes? |
| --- | --- | --- | --- | --- |
| Detector (yolos-tiny) | | | | |
| Vision (SmolVLM 256M) | | | | |
| LLM (model id) | | | | |
| Hearing (whisper-base / tiny) | | | | |

Which combination coexists on the iPhone, and which must be swapped:

### Log

- 2026-09-23, iPhone, Edge: the tab was killed near the end of the LLM load (model to confirm; the default is Qwen2.5-1.5B). The context window was still WebLLM's default of 4096 tokens; it is 2048 since ADR 0005.
- 2026-09-23, iPhone, Safari, context window 2048: with the detector (loaded in 305 ms) and vision (597 ms) already loaded, both from cache, and the camera open, the tab was killed while loading Llama-3.2-1B-Instruct-q4f16_1-MLC. Crash detection reported it on reopen. 4 Spanish system voices; camera 720x1280. Next: load the LLM alone, then add the other models one by one.
- The same sessions logged `SyntaxError: The string did not match the expected pattern` two to four times at startup, before any model was loaded. Not reproducible in Chromium; error logging now includes file, line and stack to locate it.
- 2026-09-23, iPhone, Safari, context window 2048, fresh page: Llama-3.2-1B-Instruct-q4f16_1-MLC loaded alone in 2440 ms (weights cached). Loading whisper-base on top killed the tab. **LLM (1B) and whisper-base do not coexist.** Next: Llama-3.2-1B with whisper-tiny, then Qwen2.5-0.5B with whisper-tiny.
- The startup `SyntaxError` is an unhandled promise rejection with no stack. It also appeared once with no user action. That message is what Safari's `Response.json()` throws on a non-JSON body, so `Response.json()` is now instrumented to log the URL, status, body start and caller (`poc/src/diagnostics.ts`).
- 2026-09-23, iPhone, Safari: the tab was killed as soon as detection started (models loaded at the time not recorded, because detection had no crash marker yet). Since ADR 0008 detection is marked, and the detector can run on the CPU to tell WebGPU from memory.
- 2026-09-23, iPhone, Safari: with the detector (YOLOS, WebGPU, 361 ms load from cache) and vision loaded, and no LLM, the tab was killed as detection started, so this is not a memory problem. YOLOS on WASM ran without crashing at **0.2 fps** (5092 ms per frame). The detector is now selectable, with MediaPipe EfficientDet-Lite0 on WebGL as the default (ADR 0010).
- Probe on the iPhone: `builtIn.languageModel` false, `builtIn.speechRecognition` true. Safari exposes no on-device LLM to pages.
- Since ADR 0008/0009 the defaults are phases on, Llama-3.2-1B and whisper-tiny. Next run: wake an object with "Usar el centro" (no detector) and talk to it.

- 2026-09-23, iPhone, Edge, cold caches: YOLOS on WebGPU killed the tab again when detection started. Vision failed to download twice (`Load failed` after 84 s and 51 s), which is WebKit's generic network error. The startup `SyntaxError` never appeared in Edge, so it comes from Safari, not the app.
- 2026-09-23, iPhone, Safari, MediaPipe detector (ADR 0010):
  - **Detection works:** MediaPipe on WebGL, 500 frames at 56 ms median per frame (about 15 fps, range 27 to 252 ms), no crash. Loads in 129 to 462 ms from cache (4392 ms cold).
  - **Vision works:** loads in 0.8 to 1 s from cache, and `wake.describe` takes 6 s ("The door is white and closed.").
  - **The LLM is the blocker:**
    - Loading Llama-3.2-1B with the detector and vision loaded killed the tab twice.
    - With only the LLM loaded, phases mode loaded vision, described, freed vision, and the tab died about 2 s into soul generation.
    - With the LLM and vision both loaded, the tab died as soon as waking started.
  - Llama-3.2-1B alone loads in 1.8 to 4.8 s. Generation with nothing else loaded since the page opened is still untested; "Despertar sin cámara" exists for that test.

## Built-in AI on iOS

- The probe records `builtIn.languageModel` (a Prompt API `LanguageModel` global) and `builtIn.speechRecognition` (`SpeechRecognition` or `webkitSpeechRecognition`). Apple's on-device models (Foundation Models, on-device speech) are native frameworks; as far as we know Safari does not expose them to web pages. The probe checks this on each device rather than assuming it.

## Headline metrics

| Metric | Target | iPhone | Desktop |
| --- | --- | --- | --- |
| `talk.firstAudioFromRelease` | < 4000 iPhone, < 2500 desktop | | |
| `wake.total` | < 12000 iPhone | | |
| Detection fps | >= 5 iPhone | | |
| `stt.transcribe` | | | |
| `llm.firstToken` | | | |
| `llm.fullReply` | | | |
| `wake.describe` | | | |
| `wake.createSoul` | | | |
| `memory.compact` | | | |

## Qualitative answers

- LLM size with a distinct personality in Spanish within latency targets:
- Are SmolVLM descriptions concrete enough for personal greetings? (paste two or three examples)
- Spanish system voices: count per device, variety, recommendation for neural TTS in M1:
- Memory across days: which soul, which fact, what it said:
