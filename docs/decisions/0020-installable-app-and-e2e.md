# 0020. An installable app, and end-to-end tests on the mock engine

Status: accepted, M1.

## Context

A family opens Hearthwake from the home screen, often offline or on a weak connection once the model is downloaded. Every change to the UI also needs a check that the whole flow still works. The real models cannot run in CI: they need WebGPU and an 880 MB download.

## Decision

- **Installable.**
  - The app has a web manifest, icons (including a maskable one and an Apple touch icon) and a service worker at `/hearthwake/sw.js`.
  - Pages load network first, with the cached copy as a fallback.
  - Hashed assets, including MediaPipe's WASM, are served from the cache once fetched.
  - The service worker ignores other origins (model weights are cached by WebLLM and MediaPipe themselves) and everything under `/hearthwake/poc/`, so the spike keeps its own behaviour.
- **No surprise downloads.** A returning visitor whose model files were deleted sees the first-run screen again, and nothing downloads until they tap it (`hasModelInCache`).
- **The screen stays on** during the first download and while a thing wakes up (Wake Lock API, best effort).
- **Replay:** tapping something a soul said makes it say it again, for children who cannot read yet.
- **End-to-end tests** (`app/e2e/`, Playwright, Chromium with an iPhone 13 viewport) run the real UI against the mock engine (`?mock`):
  - first run
  - waking with the camera (a fake camera)
  - typing to a soul
  - its page, and a reload
  - waking from a description
  - letting a soul sleep
  - settings
  - the unsupported-browser screen

  CI runs them after the build.

## Consequences

- The e2e tests cover the UI and the storage, not the models. Model behaviour stays covered by unit tests with fake backends, and by measurements on real devices in `docs/models.md`.
- `@playwright/test` is pinned to 1.56, which matches the Chromium preinstalled in Claude Code's cloud containers. CI installs its own browser.
