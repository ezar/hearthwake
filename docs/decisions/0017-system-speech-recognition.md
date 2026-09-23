# 0017. System speech recognition for hearing

Status: accepted, M0.

## Context

The first complete camera wake on the iPhone ran in Chrome for iOS, with the camera, the classifier and Llama-3.2-1B in one page. "Hold to talk" stayed disabled, because it needs a hearing model, and Whisper was the only option. Whisper beside the LLM had already killed Safari (whisper-base). Both Safari and Chrome for iOS expose `webkitSpeechRecognition`: the probe reports `builtIn.speechRecognition: true`.

## Decision

- Add "System speech recognition" as a hearing option, and make it the default.
  - It loads no model, so "Hold to talk" works as soon as a soul is awake, with no Load tap.
  - It listens in `en-US` while the button is held, and collects final results until release.
- `stt.transcribe` measures from release to the recognizer's last result, as it did for Whisper.
- Whisper tiny and base stay selectable. Loading one takes over from system recognition.

## Consequences

- Hearing costs no memory next to the LLM.
- It may not be local: WebKit's recognizer can send audio to Apple's servers, depending on the iOS version and settings. That departs from "every model runs locally". It is accepted for M0 so that talking can be measured at all; M1 decides whether it is acceptable.
- The first use asks for microphone and speech recognition permission.
