# 0014. Wake a thing in two steps, with a page reload between vision and the LLM

Status: accepted, M0. Supersedes the phases mode of ADR 0008. Since ADR 0016 it applies only when SmolVLM is the vision engine; on the iPhone the reload did not free memory.

## Context

Measured on the iPhone (docs/models.md):

- Vision on its own works: it loads in about 1 s from cache and describes in 6 s.
- The LLM on its own works: Llama 3.2 1B makes a soul in about 4 to 6 s.
- Phases mode (ADR 0008) loaded vision, described, freed vision and then generated with the LLM in the same page load. The tab died about 2 s into generation. Loading the LLM with vision already loaded also killed it. Freeing a transformers.js model does not return its GPU memory in time.

The only reliable reset is a fresh page load.

## Decision

"Wake in two steps" replaces phases mode and is on by default:

1. **Camera page.** "Wake this thing" crops the selection and stops detection.
   - If the LLM has not been loaded in this page load, it frees the detector and hearing, loads vision and describes the crop.
   - It saves a pending wake in `localStorage` (`hearthwake.poc.pendingWake`): the label, the crop as a JPEG data URL, the description (or null), the chosen LLM and the start time. Then it reloads the page.
2. **After the reload.** A banner at the top shows the pending wake. Tapping Start (a gesture iOS needs before the greeting can be spoken) continues it:
   - with no description yet, it loads vision, describes the saved crop and reloads again;
   - with a description, it loads the chosen LLM, creates the soul and greets.
3. **Failure and recovery.** If a step fails or the tab dies, the pending wake stays, so Start or Continue retries it and Cancel discards it.

The option can be turned off to run everything in one page load, as the spec first described, for devices with enough memory.

Hearing is no longer loaded automatically after waking: Whisper next to the LLM also killed the tab. Talking by text works; speech recognition is a separate decision.

## Consequences

- Waking takes one or two reloads and a tap. `wake.twoStepTotal` measures it end to end, including the tap; `wake.describe` and `wake.createSoul` still time each model.
- The camera page never holds the LLM and vision together, and the soul page never loads vision after the LLM.
- Detection with MediaPipe (WebGL) runs on the camera page only.
