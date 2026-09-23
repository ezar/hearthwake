# 0017. Close M0: the in-browser Lite tier does not work on the iPhone

Status: accepted, closes M0. The M1 approach below is a proposal to be chosen at the start of M1.

## Context

M0 asked whether an iPhone, inside Safari, can wake a household object and talk to it with every AI model running locally in the browser. The measurements are in `docs/models.md`. All of them come from one iPhone on iOS 27.2 (Safari and Edge), since no desktop run was made.

What works on the iPhone:

- WebGPU with fp16 shaders. `maxBufferSize` is 1024 MB.
- Detection with MediaPipe EfficientDet-Lite0 on WebGL: about 15 fps (56 ms per frame), no crash, alongside the camera and SmolVLM (ADR 0010).
- SmolVLM 256M alone: loads in about 1 s from cache and describes a crop in 3 to 6 s.
- Llama-3.2-1B (WebLLM, q4f16) alone, in a tab that has loaded nothing else: loads in 2 to 5 s and creates English souls in 4 to 14 s with the hand-written grammar (ADR 0013).
- System voices: 29 English, 4 Spanish.
- `SpeechRecognition` exists in Safari. No built-in LLM is exposed to pages.

What does not:

- **The LLM coexists with nothing.** Safari killed the tab whenever the LLM loaded or generated next to any other model or the open camera:
  - detector and vision
  - whisper-base
  - vision freed in the same page (ADR 0008)
  - SmolVLM before a page reload (ADR 0014)
  - the camera alone, before the classifier even loaded (ADR 0016)
- **A reload does not free memory.** Safari keeps the process, so WASM and GPU memory survive `location.reload()` (ADR 0016, and the last runs).
- **The first LLM load often kills the tab,** even alone. The second attempt usually works.
- YOLOS on WebGPU killed the tab at the first frame. On WASM it ran at 0.2 fps.
- Gemma 3 1B looped in JSON. Llama 3.2 1B's souls are generic and often ignore the object's appearance.

So none of the target flows (wake with the camera, then talk by voice) completed on the iPhone. Talking, `wake.total` and memory across days were never measured there.

## Decision

- Stop M0 here. The in-browser "Lite" tier, where every model runs inside Safari on the iPhone, is not viable with today's WebKit memory limits. Smaller models would only trade memory for souls that are already too weak.
- Keep what worked as reusable findings for M1:
  - MediaPipe detection on WebGL
  - the soul grammar and crash forensics
  - English souls and UI
  - system voices and Safari's `SpeechRecognition` for hearing, instead of Whisper
- Leave `poc/` as is, deployed, as the record of the spike.

## M1 options (to choose)

1. **Native iOS app.** It would use:
   - Apple's Foundation Models framework, an on-device LLM of about 3B parameters on devices with Apple Intelligence
   - Vision for classification
   - Speech for recognition
   - AVSpeechSynthesizer for voices

   Everything stays on the device, and it avoids Safari's per-tab memory limit. It costs a Swift codebase and App Store distribution, and it needs Apple Intelligence hardware. This is the only option that keeps "all local" on the iPhone.
2. **Web app with the LLM elsewhere.** The camera, detection (MediaPipe), hearing (`SpeechRecognition`) and voices stay in the browser. The LLM runs on a home machine (for example Ollama on the local network) or a hosted API. This keeps the web stack and the M0 code, but gives up "all local on the phone".
3. **In-browser on desktop only.** The Lite tier becomes a desktop tier. The iPhone uses option 1 or 2.

## Consequences

- The spec's acceptance criteria stay partly unanswered: desktop numbers, talk latency, `wake.total` and memory across days. They are to be measured in whichever M1 option is chosen.
- `docs/models.md` holds the full log of iPhone runs.
