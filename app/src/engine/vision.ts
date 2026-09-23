// Seeing a thing: MediaPipe's image classifier names it (1000 ImageNet classes), and the crop's pixels give
// its colours: "An orange and grey sliding door." A few MB on the CPU, so it shares a page with the LLM on
// the iPhone, which SmolVLM could not (ADR 0016).
import type { ImageClassifier } from '@mediapipe/tasks-vision';
import { describeThing, dominantColours } from './colours';
import { log, timed } from './metrics';

const MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite2/int8/1/efficientnet_lite2.tflite';
const MODEL_CACHE = 'mediapipe-models';
// Below this the top class is a guess, and the thing is just "thing".
const MIN_SCORE = 0.15;

export interface Sight {
  label: string | null;
  description: string;
  guesses: { label: string; score: number }[];
}

export interface VisionBackend {
  load(): Promise<void>;
  classify(canvas: HTMLCanvasElement): { label: string; score: number }[];
}

async function fetchModel(url: string): Promise<Uint8Array> {
  const cache = self.caches ? await caches.open(MODEL_CACHE) : null;
  let response = await cache?.match(url);
  if (!response) {
    const fresh = await fetch(url);
    if (!fresh.ok) throw new Error(`Could not download the vision model (${fresh.status})`);
    await cache?.put(url, fresh.clone());
    response = fresh;
  }
  return new Uint8Array(await response.arrayBuffer());
}

// ImageNet names list synonyms: "teddy, teddy bear" becomes "teddy".
export const shortLabel = (name: string) => name.split(',')[0]!.trim().toLowerCase();

export function mediaPipeVision(): VisionBackend {
  let classifier: ImageClassifier | null = null;
  return {
    async load() {
      if (classifier) return;
      const [{ ImageClassifier }, wasmLoaderPath, wasmBinaryPath, model] = await Promise.all([
        import('@mediapipe/tasks-vision'),
        import('@mediapipe/tasks-vision/vision_wasm_internal.js?url').then(m => m.default),
        import('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url').then(m => m.default),
        fetchModel(MODEL),
      ]);
      // CPU on purpose: the int8 model fails on the GPU delegate, and it keeps GPU memory for the LLM.
      classifier = await ImageClassifier.createFromOptions(
        { wasmLoaderPath, wasmBinaryPath },
        { baseOptions: { modelAssetBuffer: model, delegate: 'CPU' }, runningMode: 'IMAGE', maxResults: 3 },
      );
    },
    classify(canvas) {
      if (!classifier) throw new Error('The vision model is not loaded');
      const categories = classifier.classify(canvas).classifications[0]?.categories ?? [];
      return categories.map(c => ({ label: shortLabel(c.categoryName), score: c.score }));
    },
  };
}

// Pure, for tests: from the classifier's guesses and the crop's pixels to a sentence.
export function sightFrom(guesses: { label: string; score: number }[], pixels: ArrayLike<number>): Sight {
  const top = guesses[0];
  const label = top && top.score >= MIN_SCORE ? top.label : null;
  return { label, description: describeThing(label ?? 'thing', dominantColours(pixels)), guesses };
}

export function look(vision: VisionBackend, canvas: HTMLCanvasElement): Promise<Sight> {
  return timed('wake.describe', async () => {
    const guesses = vision.classify(canvas);
    log(
      `Classifier: ${guesses.map(g => `${g.label} ${Math.round(g.score * 100)}%`).join(', ') || 'nothing'}`,
    );
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    return sightFrom(guesses, data);
  });
}
