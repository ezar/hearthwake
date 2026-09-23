# 0002. Load model libraries lazily

Status: accepted, M0.

## Context

transformers.js and WebLLM together are about 7 MB of JavaScript plus the ONNX Runtime WASM (about 21 MB). The page must be usable, and the probe must run, before any of that matters. The pure logic (sentence splitter, JSON repair, history trimming, compaction, stats) must be unit-testable in Node, where importing transformers.js pulls in native dependencies.

## Decision

Each module imports its library with a dynamic `import()` inside the load function, and uses `import type` for everything else. The WebLLM model list is also read through a dynamic import when the probe finishes.

## Consequences

- First load of the page downloads only about 25 KB of app code; each library downloads on first Load and is cached by the browser.
- Tests import the real modules without mocks for the libraries.
- `npm audit` reports `sharp` (a Node-only dependency of transformers.js v3) as vulnerable. It never reaches the browser bundle; the fix is transformers.js v4, which is outside the M0 spec. Revisit in M1.
