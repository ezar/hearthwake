# 0023. Spanish, and a choice of model

Status: accepted, M1. Amends ADR 0012 (English only).

## Context

ADR 0012 switched souls and UI to English because Llama 3.2 1B wrote poor Spanish on the iPhone. The family the app is for speaks Spanish, and so does much of the audience of the experiment. Devices with more memory can run larger models that write Spanish well.

## Decision

- **Two interface languages, English and Spanish.**
  - English text is the key: `t('Wake something')` shows the Spanish from `app/src/i18n-es.ts` when Spanish is chosen, and falls back to English for anything missing.
  - A unit test checks that every literal passed to `t()` has a Spanish entry, with the same placeholders.
  - The first language follows the browser's; Settings → Language changes it at once and keeps it.
- **Souls follow the language:**
  - Prompts ask for the chosen language: soul creation, conversation, memory summaries, riddles.
  - Speech recognition uses `es-ES` or `en-US`, and voices are picked among the system voices of that language.
  - The JSON field names and the voice words stay English, because the grammar fixes them.
- **Descriptions stay English.** They are built from ImageNet labels and colour names, which are English, and the LLM reads them either way.
- **A choice of model** in Settings, each with its memory estimate:
  - Llama 3.2 1B stays the default and the only one measured on the iPhone.
  - Qwen 2.5 1.5B writes better Spanish.
  - Llama 3.2 3B writes best, on computers.

  A new model downloads on the next start, through the first-run screen, because the app checks whether the chosen model is cached.

## Consequences

- Spanish souls with the 1B model will make more mistakes than English ones. The onboarding says so, and the fix is a larger model where memory allows.
- Every new UI string needs a Spanish entry, or the i18n test fails.
- Whether Qwen 2.5 1.5B fits beside the camera on the iPhone is unmeasured.
