// Light describer: MediaPipe's image classifier names the thing (1000 ImageNet classes, including
// radiator, table lamp and teddy bear) and the crop's pixels give its colours. A few MB on WebGL, where
// SmolVLM needs hundreds of MB in ONNX Runtime and could not share a page load with the LLM on the
// iPhone (ADR 0016).
import type { ImageClassifier } from '@mediapipe/tasks-vision';
import { describeThing, dominantColours } from './colours';
import { fetchModel, visionFileset } from './mediapipe';
import { log } from './report';

const MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite2/int8/1/efficientnet_lite2.tflite';
// Below this the top class is a guess, so the tester's label (or "object") is kept instead.
const MIN_SCORE = 0.15;

let classifier: ImageClassifier | null = null;

export async function loadClassifier(): Promise<void> {
  const [{ ImageClassifier }, fileset, model] = await Promise.all([
    import('@mediapipe/tasks-vision'),
    visionFileset(),
    fetchModel(MODEL),
  ]);
  // CPU on purpose: the int8 model fails on MediaPipe's GPU delegate at classification time
  // ("Unsupported input tensor type: Float32"), and one image a wake is quick on the CPU. It also keeps
  // the GPU memory free for the LLM.
  classifier = await ImageClassifier.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: model, delegate: 'CPU' },
    runningMode: 'IMAGE',
    maxResults: 3,
  });
}

export function unloadClassifier(): void {
  classifier?.close();
  classifier = null;
}

// ImageNet names list synonyms: "teddy, teddy bear" becomes "teddy".
export const shortLabel = (name: string) => name.split(',')[0]!.trim().toLowerCase();

export function classifyAndDescribe(canvas: HTMLCanvasElement): { text: string; label: string | null } {
  if (!classifier) throw new Error('Load the vision model first');
  const categories = classifier.classify(canvas).classifications[0]?.categories ?? [];
  log(
    `Classifier: ${categories.map(c => `${shortLabel(c.categoryName)} ${Math.round(c.score * 100)}%`).join(', ')}`,
  );
  const top = categories[0];
  const label = top && top.score >= MIN_SCORE ? shortLabel(top.categoryName) : null;
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  return { text: describeThing(label ?? 'thing', dominantColours(data)), label };
}
