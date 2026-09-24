// Seeing a thing: MediaPipe's image classifier names it (1000 ImageNet classes), and the crop's pixels give
// its colours: "An orange and grey sliding door." A few MB on the CPU, so it shares a page with the LLM on
// the iPhone, which SmolVLM could not (ADR 0016). An image embedder (4 MB) gives each thing a signature, so
// a thing that already woke up is recognised when the camera sees it again (ADR 0021).
import type { ImageClassifier, ImageEmbedder } from '@mediapipe/tasks-vision';
import { describeThing, dominantColours } from './colours';
import { log, timed } from './metrics';

const MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite2/int8/1/efficientnet_lite2.tflite';
const EMBEDDER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite';
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
  // A unit-length signature of what the image shows; similar things give a cosine similarity near 1.
  embed(canvas: HTMLCanvasElement | HTMLImageElement): number[];
}

// Cosine similarity of two signatures (0 for mismatched or empty ones).
export function similarity(a: readonly number[], b: readonly number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// Signatures are stored with each soul; three decimals keep them small with no visible loss.
export const compactSignature = (v: readonly number[]) => v.map(x => Math.round(x * 1000) / 1000);

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
  let embedder: ImageEmbedder | null = null;
  return {
    async load() {
      if (classifier && embedder) return;
      const [{ ImageClassifier, ImageEmbedder }, wasmLoaderPath, wasmBinaryPath, model, embedderModel] =
        await Promise.all([
          import('@mediapipe/tasks-vision'),
          import('@mediapipe/tasks-vision/vision_wasm_internal.js?url').then(m => m.default),
          import('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url').then(m => m.default),
          fetchModel(MODEL),
          fetchModel(EMBEDDER_MODEL),
        ]);
      const fileset = { wasmLoaderPath, wasmBinaryPath };
      // CPU on purpose: the int8 model fails on the GPU delegate, and it keeps GPU memory for the LLM.
      classifier = await ImageClassifier.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: model, delegate: 'CPU' },
        runningMode: 'IMAGE',
        maxResults: 3,
      });
      embedder = await ImageEmbedder.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: embedderModel, delegate: 'CPU' },
        runningMode: 'IMAGE',
        l2Normalize: true,
      });
    },
    classify(canvas) {
      if (!classifier) throw new Error('The vision model is not loaded');
      const categories = classifier.classify(canvas).classifications[0]?.categories ?? [];
      return categories.map(c => ({ label: shortLabel(c.categoryName), score: c.score }));
    },
    embed(image) {
      if (!embedder) throw new Error('The vision model is not loaded');
      return embedder.embed(image).embeddings[0]?.floatEmbedding ?? [];
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
