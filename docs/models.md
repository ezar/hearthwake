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
