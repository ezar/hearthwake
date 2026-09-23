# 0018. Close M0 and set the direction for M1

Status: accepted. Closes M0.

## Context

M0 asked whether an iPhone can wake a household object and talk to it, with the AI running in the browser. On 2026-09-24 the whole loop ran on the iPhone (iOS 27.2, 4 cores) in Chrome for iOS, which uses WebKit:

1. Open the camera.
2. Classify the crop.
3. Create a soul.
4. Greet.
5. Reply to typed messages.
6. Reply to speech.

The measurements are in `docs/models.md`.

What worked, all in one page:

- The camera at 720p.
- MediaPipe's image classifier plus pixel colours: 0.1 s to load from cache, 0.1 s per description (ADR 0016).
- Llama-3.2-1B-Instruct q4f16 through WebLLM:
  - load: 2 s from cache, 38 s cold
  - soul creation: about 18 s with the hand-written grammar (ADR 0013)
- System speech recognition for hearing (ADR 0017).
- System voices for speech: 29 English voices.
- MediaPipe object detection at about 15 fps (ADR 0010). It was tested beside SmolVLM, not beside the LLM.

What did not:

- Loading the LLM beside SmolVLM, Whisper or YOLOS: Safari killed the tab every time.
- A reload between steps: it does not free WASM or GPU memory in WebKit (ADR 0016).
- Safari after dozens of crashes in one session. A freshly started browser worked. Safari was never re-run fresh.

## Decision

- **M0 is closed.** In-browser on the iPhone is viable, within a tight memory budget.
- **M1 builds the app in the browser, with the M0 model set:**
  - the LLM: Llama-3.2-1B q4f16, loaded first, one per page
  - vision: the MediaPipe classifier plus colours
  - hearing: system speech recognition
  - speech: system voices

  SmolVLM, Whisper and YOLOS are dropped. The MediaPipe detector is optional, only if it fits beside the LLM.
- **English** for souls and UI (ADR 0012).
- **The PoC stays available.** `poc/` is kept as is, as the M0 test harness, and stays deployed at `/hearthwake/poc/`. The app gets its own folder and path, and the Pages workflow publishes both.
- **The design** for M1's core loop is the "Hearthwake app design" canvas:
  - screens: first run, the hearth (list of souls), wake, waking up, talk, and the soul's page
  - look: a warm dark theme, Fraunces over Figtree, one ember accent (`#F08A4B`)

## Consequences

Open questions carried into M1:

- **Soul creation speed:** it takes about 18 s, over the 12 s target. Possible fixes are shorter fields, or a greeting generated after the soul.
- **Safari:** it needs a fresh-start run.
- **Memory across days:** never tested.
- **Desktop numbers:** never measured.
- **Privacy:** system speech recognition may send audio to Apple, so the app must not promise "nothing leaves the phone" for speech.
