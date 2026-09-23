# 0016. Describe things with an image classifier and pixel colours

Status: accepted, M0. Makes the two-step wake (ADR 0014) a SmolVLM-only option.

## Context

The two-step wake relied on a page reload to free vision's memory before the LLM. On the iPhone it did not. After `location.reload()`, loading SmolVLM failed at once, ten times in a row, with `no available backend found. ERR: [webgpu] RangeError: Out of memory`. Safari appears to keep the same process across a reload, so ONNX Runtime's WASM memory is not given back. Only a tab killed by the system started clean.

SmolVLM's descriptions were thin anyway ("The door is white and closed.").

## Decision

- **A second vision engine, the default:** MediaPipe's image classifier (EfficientNet-Lite2 int8, 7.2 MB, 1000 ImageNet classes, including radiator, table lamp and teddy bear), plus the dominant colours of the crop, computed from its pixels (`poc/src/colours.ts`).
  - The description is a short sentence such as "A white radiator.", and the top classes are logged with their scores.
  - A class under 15% is treated as a guess.
  - With "Use the centre", the classifier's label replaces "object" as the soul's label.
- **It runs on the CPU delegate.** The int8 model fails on MediaPipe's GPU delegate when classifying ("Unsupported input tensor type: Float32"), and one image per wake is quick on the CPU: about 0.2 s in a headless container. That also keeps GPU memory for the LLM.
- **Waking with the classifier is a single page load.** It loads the LLM first, while memory is cleanest, then the classifier, then describes and creates the soul. No reloads.
- **SmolVLM stays selectable** for richer text, with the two-step option.
- **Shared plumbing.** MediaPipe's WASM fileset and model caching moved to `poc/src/mediapipe.ts`, used by the detector and the classifier.
- **Log across reloads.** A deliberate reload now carries the log and timings over, so a two-step wake no longer loses the camera page's record.

## Consequences

- Descriptions are coarser: a class and colours, no materials or condition. The LLM has less to personalize the greeting with.
- The memory left on the camera page is the LLM (about 900 MB), a few MB of classifier, and optionally the MediaPipe detector. Whether the LLM generates with those loaded is the next thing to measure on the iPhone.
