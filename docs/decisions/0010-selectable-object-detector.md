# 0010. Selectable object detector, with MediaPipe as the default

Status: accepted, M0. Amends the spec's detector (YOLOS tiny only).

## Context

On the iPhone (iOS 27.2, Safari), YOLOS tiny through transformers.js:

- on WebGPU killed the tab on the first detection frame, with only the detector and vision loaded, so not for lack of memory;
- on WASM ran at 0.2 fps (about 5 s per frame), against a target of 5 fps. GitHub Pages is not cross-origin isolated, so WASM runs single-threaded.

Another project by the same author, theremano, runs MediaPipe hand tracking smoothly on the same phone. MediaPipe's GPU delegate uses WebGL, which is mature on Safari. Its models are a few MB, and it falls back to the CPU.

## Decision

The tester picks the detector and where it runs:

| Option | Engine | Model |
| --- | --- | --- |
| MediaPipe · GPU (WebGL), default | `@mediapipe/tasks-vision` | EfficientDet-Lite0 float16 (7.3 MB, Apache 2.0, COCO labels) |
| MediaPipe · CPU | same | same |
| YOLOS · GPU (WebGPU) | transformers.js | `Xenova/yolos-tiny`, fp32 (only with WebGPU) |
| YOLOS · CPU (WASM) | transformers.js | `Xenova/yolos-tiny`, q8 |

- Both engines sit behind one interface (`poc/src/detectors.ts`) that returns boxes normalized to 0..1, so the overlay, selection tracking and crop are unchanged.
- MediaPipe gets the whole video frame in `VIDEO` mode, with a score threshold of 0.5 (EfficientDet scores run lower than YOLOS). YOLOS keeps 0.6 on a 320 px frame.
- The MediaPipe WASM runtime is served from the site, bundled by Vite. The model is downloaded from Google's model storage and kept in Cache Storage (`mediapipe-models`), so "Borrar modelos descargados" clears it too.
- Load and per-frame timings carry the option name (`load.detector.<option>`, `detect.frame.<option>`), and the crash marker says which option was detecting.

## Consequences

- In a headless Chromium container without a GPU, MediaPipe on the CPU reached 6.5 fps; the iPhone figures are still to be measured.
- Both engines know only the 80 COCO classes. Things like radiators and lamps still go through "Usar el centro" and the vision model. MediaPipe's image classifier (1000 ImageNet classes, including radiator and table lamp) is a candidate if the vision descriptions fall short.
- One more runtime (MediaPipe) in the bundle, loaded lazily like the others.
