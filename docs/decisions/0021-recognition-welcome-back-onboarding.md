# 0021. Recognising things, welcoming friends back, and an onboarding

Status: accepted, M1.

## Context

A thing woke up once and was then a stranger: pointing the camera at the same door made a new soul, and a soul never mentioned the days in between. New visitors, many arriving from a social post, also landed straight on a download screen with little idea of what the experience is.

## Decision

- **A signature for each photo.**
  - MediaPipe's image embedder (MobileNet V3 small, 4 MB, CPU) runs beside the classifier. It loads after the LLM, like the classifier (ADR 0016).
  - Each soul woken from a photo stores the photo's unit-length signature, rounded to three decimals.
  - Souls from before this change get theirs from their saved photo the first time they are compared.
- **Recognition.**
  - After the look step, the new signature is compared with every soul's.
  - A soul is a match at cosine similarity 0.8, or 0.7 when the classifier gives the same label.
  - The person always confirms: "Is this Flibber?" Yes opens that soul's conversation; "No, it's someone new" goes on to create a soul.
  - The thresholds are a first guess. The similarities are logged in Diagnostics so they can be tuned on real devices.
- **Welcome back.** A soul greets its friend like an old friend when the camera recognised it, or when three hours or more have passed since they last talked.
  - The greeting prompt carries the soul's memory summary, its last messages and how long it has been ("A day has passed").
  - It asks the soul to mention or ask about something it was told.
  - The greeting is saved as a message.
- **Onboarding.** Three cards, swiped or stepped through, come before the first download:
  - the things in your home wake up;
  - talk to them and they remember;
  - an experiment in AI on your device, with its limits: the download size, about 20 s to wake, English only.

  They can be skipped, and Settings → "About this experiment" shows them again.

## Consequences

- The embedder adds 4 MB to download and a few MB of memory, next to the LLM. Watch for crashes on the iPhone.
- A welcome back costs one short generation (at most 90 tokens) when a conversation opens.
- Two photos of look-alike things (two white doors) can be taken for the same soul. The confirmation question keeps that harmless.
