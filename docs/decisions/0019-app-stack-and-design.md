# 0019. The M1 app: stack, structure and design

Status: accepted, M1.

## Context

M0 proved the loop on the iPhone in a single page load (ADR 0018). M1 turns it into an app a family can use. The spike stays as the test harness.

## Decision

- **Where things live:**
  - The app is in `app/`, served from `/hearthwake/`.
  - The spike stays in `poc/`, served from `/hearthwake/poc/`.
  - One workflow, `.github/workflows/ci.yml`, checks and builds both and publishes them together to GitHub Pages.
- **Stack:**
  - Vite, React 19 and TypeScript (strict), with the same lint, format and test tooling as the spike.
  - Hash routes, so Pages needs no server rewrites.
  - No state library: small stores built on `useSyncExternalStore`.
- **Storage:**
  - Souls and settings live in IndexedDB, in database `hearthwake`.
  - Souls saved by the spike (`localStorage` on the same origin) are imported once.
- **Engine** (`app/src/engine/`): ported from the spike with the M0 model set.
  - Llama-3.2-1B q4f16 through WebLLM (q4f32 without fp16 shaders).
  - MediaPipe's image classifier plus pixel colours.
  - System speech recognition and system voices.
  - The LLM starts loading as soon as a returning visitor opens the app, before the camera, and the classifier loads only after it (ADR 0016).
  - Everything the UI needs from the models goes through two small interfaces (`LlmBackend`, `VisionBackend`).
- **Faster souls:** the grammar's field limits are tighter than the spike's (3 or 4 traits, shorter strings), aiming at the 12 s target. A soul took about 18 s on the iPhone.
- **Mock engine:** `?mock` in the URL swaps in canned backends. It lets the whole flow be exercised on machines without WebGPU, including headless browsers in tests. It is never used unless asked for.
- **Design:** the "Hearthwake app design" canvas.
  - Look: a warm dark theme, Fraunces over Figtree (self-hosted through Fontsource), one ember accent.
  - Each soul gets a tint from its name, used for the ring around its photo.
  - Screens: first run, the hearth, wake, waking up, talk, the soul's page, describe and settings.
- **Privacy wording:** the app says the AI runs on the device. It never claims that speech stays on the device, because system recognition may use the browser maker's servers (ADR 0017).

## Consequences

- The first visit downloads about 880 MB. Later visits load the model from Cache Storage in about 2 s on the iPhone.
- Settings can delete the downloaded models without touching souls.
- The spike and the app share an origin, so the spike's souls appear in the app. "Delete downloaded models" in either one clears both of their model caches.
