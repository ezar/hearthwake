// Object detector backends. Both return boxes normalized to 0..1 of the video frame, so the overlay,
// selection and crop code does not care which one runs.
//
// - YOLOS tiny through transformers.js (ONNX Runtime), on WebGPU or WASM. The spec's original choice.
// - EfficientDet-Lite0 through MediaPipe Tasks, on its GPU delegate (WebGL) or CPU. On the iPhone the
//   YOLOS WebGPU path killed Safari on the first frame and its WASM path ran at 0.2 fps (ADR 0010).
import type { Detection } from './camera';

export type DetectorChoice = 'mediapipe-gpu' | 'mediapipe-cpu' | 'yolos-webgpu' | 'yolos-wasm';

export const DETECTORS: Record<DetectorChoice, { model: string; label: string; needsWebGpu: boolean }> = {
  'mediapipe-gpu': {
    model: 'mediapipe/efficientdet_lite0',
    label: 'MediaPipe · GPU (WebGL)',
    needsWebGpu: false,
  },
  'mediapipe-cpu': { model: 'mediapipe/efficientdet_lite0', label: 'MediaPipe · CPU', needsWebGpu: false },
  'yolos-webgpu': { model: 'Xenova/yolos-tiny', label: 'YOLOS · GPU (WebGPU)', needsWebGpu: true },
  'yolos-wasm': { model: 'Xenova/yolos-tiny', label: 'YOLOS · CPU (WASM)', needsWebGpu: false },
};

export interface DetectorBackend {
  detect(video: HTMLVideoElement): Promise<Detection[]>;
  dispose(): Promise<void>;
}

const THRESHOLD = 0.6;
const YOLOS_WIDTH = 320;
// EfficientDet-Lite0 scores run lower than YOLOS for the same objects; 0.5 is MediaPipe's usual cut.
const MEDIAPIPE_THRESHOLD = 0.5;
const MEDIAPIPE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
// Same Cache Storage as the other libraries, so "Borrar modelos descargados" clears it too.
const MEDIAPIPE_CACHE = 'mediapipe-models';

export async function createDetector(choice: DetectorChoice): Promise<DetectorBackend> {
  return choice.startsWith('mediapipe')
    ? createMediaPipe(choice === 'mediapipe-gpu' ? 'GPU' : 'CPU')
    : createYolos(choice === 'yolos-webgpu' ? 'webgpu' : 'wasm');
}

async function createYolos(device: 'webgpu' | 'wasm'): Promise<DetectorBackend> {
  const tf = await import('@huggingface/transformers');
  const pipe = (await tf.pipeline('object-detection', 'Xenova/yolos-tiny', {
    device,
    dtype: device === 'webgpu' ? 'fp32' : 'q8',
  })) as unknown as ((image: unknown, options: object) => Promise<Detection[]>) & {
    dispose(): Promise<void>;
  };
  const frame = document.createElement('canvas');
  const ctx = frame.getContext('2d', { willReadFrequently: true })!;
  return {
    async detect(video) {
      frame.width = YOLOS_WIDTH;
      frame.height = Math.round((YOLOS_WIDTH * video.videoHeight) / video.videoWidth);
      ctx.drawImage(video, 0, 0, frame.width, frame.height);
      const { data } = ctx.getImageData(0, 0, frame.width, frame.height);
      const image = new tf.RawImage(data, frame.width, frame.height, 4).rgb();
      return pipe(image, { threshold: THRESHOLD, percentage: true });
    },
    dispose: () => pipe.dispose(),
  };
}

async function fetchCached(url: string): Promise<Uint8Array> {
  const cache = await caches.open(MEDIAPIPE_CACHE);
  let response = await cache.match(url);
  if (!response) {
    const fresh = await fetch(url);
    if (!fresh.ok) throw new Error(`Could not download the detector (${fresh.status})`);
    await cache.put(url, fresh.clone());
    response = fresh;
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function createMediaPipe(delegate: 'GPU' | 'CPU'): Promise<DetectorBackend> {
  const [{ ObjectDetector }, { default: wasmLoaderPath }, { default: wasmBinaryPath }, model] =
    await Promise.all([
      import('@mediapipe/tasks-vision'),
      // Served from this site, like the other WASM runtimes, instead of Google's CDN.
      import('@mediapipe/tasks-vision/vision_wasm_internal.js?url'),
      import('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'),
      fetchCached(MEDIAPIPE_MODEL),
    ]);
  const detector = await ObjectDetector.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetBuffer: model, delegate },
      runningMode: 'VIDEO',
      scoreThreshold: MEDIAPIPE_THRESHOLD,
      maxResults: 10,
    },
  );
  let lastTimestamp = 0;
  return {
    async detect(video) {
      // VIDEO mode requires strictly increasing timestamps.
      lastTimestamp = Math.max(lastTimestamp + 1, Math.round(performance.now()));
      const { detections } = detector.detectForVideo(video, lastTimestamp);
      return toNormalized(detections, video.videoWidth, video.videoHeight);
    },
    async dispose() {
      detector.close();
    },
  };
}

interface PixelDetection {
  categories: { categoryName: string; score: number }[];
  boundingBox?: { originX: number; originY: number; width: number; height: number };
}

// MediaPipe reports boxes in pixels of the input frame; the rest of the app works in 0..1.
export function toNormalized(detections: PixelDetection[], width: number, height: number): Detection[] {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  return detections.flatMap(d => {
    const top = d.categories[0];
    const b = d.boundingBox;
    if (!top || !b || !width || !height) return [];
    return [
      {
        label: top.categoryName,
        score: top.score,
        box: {
          xmin: clamp01(b.originX / width),
          ymin: clamp01(b.originY / height),
          xmax: clamp01((b.originX + b.width) / width),
          ymax: clamp01((b.originY + b.height) / height),
        },
      },
    ];
  });
}
