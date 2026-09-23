# 0007. Button to clear downloaded models

Status: accepted, M0.

## Context

Model weights stay in the browser after the first download (about 1.3 GB on the iPhone after the first session). Testers need to free that space, and to measure cold loads again, without losing their souls. The browser's own settings can only delete everything for the origin, and on Edge for iOS only everything for every site.

## Decision

The Models panel has a "Borrar modelos descargados" button. After confirmation it deletes every Cache Storage cache of the origin (`transformers-cache`, `webllm/model`, `webllm/config`, `webllm/wasm`) and any IndexedDB database, then logs what it deleted and the storage usage before and after. The panel shows the current usage at startup and after each load.

Souls, the log mirror and the crash marker are in `localStorage` and are not touched.

## Consequences

- Loaded models keep working, because their weights are already in memory; the next load downloads them again.
- The ONNX Runtime WASM file (about 21 MB) is cached by the browser's HTTP cache, which a page cannot clear.
