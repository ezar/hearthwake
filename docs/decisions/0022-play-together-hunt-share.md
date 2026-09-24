# 0022. Play: things talk to each other, a treasure hunt, and shareable cards

Status: accepted, M1.

## Context

Once a few things are awake, the app had only one-to-one conversations. Families asked what else they could do with them, and the experiment needs a way to travel beyond the phone it runs on.

## Decision

- **"Let them talk"** (`#/together`). Pick two things and a topic, and they exchange six lines, each spoken in its own voice.
  - Each line is one short generation (at most 80 tokens) as that thing.
  - The other thing's lines are the user turns and its own are the assistant turns, so the chat template stays valid.
  - The exchange is not saved.
- **Treasure hunt** (`#/hunt`), three rounds, shown on the hearth once there are two things and at least one has a photo.
  - One thing with a photo hides, and another gives a riddle about it.
  - The riddle is one non-streamed generation. If the model still names the hidden thing or its label, the word is blanked.
  - The player finds the thing and points the camera at it. The camera compares its signature (ADR 0021) with the hidden thing's a few times a second; two looks in a row at 0.7 or above count as found.
  - The player can ask for an easier clue or give up.
- **Shareable card:** a Share button on a soul's page draws a 1080×1350 PNG on a canvas, entirely on the device.
  - The card shows the photo, name, title, catchphrase and traits, with the app's address.
  - It goes through the system share sheet where files can be shared, and is downloaded elsewhere.

## Consequences

- Each play feature uses the one LLM already loaded. Nothing new is downloaded.
- The hunt only works for things woken with the camera; things woken from a description can give clues but not hide.
- The share card carries the app's address, which is the point: it travels.
