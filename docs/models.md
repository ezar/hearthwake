# M0 results

Fill in from the copied reports (`Copiar informe`) after each device session. Timings are medians in ms unless noted; add min and max where they vary a lot. See `docs/m0-spike.md` section 13 for the protocol and section 14 for what each answer needs.

## Devices

| Device | OS / browser | webgpu | shaderF16 | maxBufferSize MB | Storage quota MB |
| --- | --- | --- | --- | --- | --- |
| iPhone (4 cores) | iOS 27.2, Edge 153 (WebKit) | yes | yes | 1024 | 39322 |
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
