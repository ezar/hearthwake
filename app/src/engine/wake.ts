// Waking a thing: look at it, check whether it already woke up, and if not give it a soul. The Wake and
// Describe screens hand over what they captured; the Waking screen runs the steps and shows them.
import { newSoulId, saveSoul, type Soul } from '../store/souls';
import { ensureLlm, ensureVision } from './engine';
import { createSoul } from './llm';
import { log, record } from './metrics';
import { bestMatch, loadImage, logSimilarities, type Match } from './recognise';
import { compactSignature, look, type VisionBackend } from './vision';

export type WakeInput =
  | { kind: 'photo'; crop: HTMLCanvasElement; thumbnail: string }
  | { kind: 'words'; label: string; description: string };

export type WakeStep = 'look' | 'soul' | 'hello';

let pending: WakeInput | null = null;

export const setPendingWake = (input: WakeInput) => {
  pending = input;
};
export const takePendingWake = (): WakeInput | null => {
  const input = pending;
  pending = null;
  return input;
};

// A soul that the Talk screen should greet as a returning friend, set when the camera recognised it.
let welcomeBackFor: string | null = null;
export const requestWelcomeBack = (id: string) => {
  welcomeBackFor = id;
};
export const takeWelcomeBack = (id: string): boolean => {
  const asked = welcomeBackFor === id;
  if (asked) welcomeBackFor = null;
  return asked;
};

export interface WakeProgress {
  step: WakeStep;
  description?: string;
}

// What was seen: a photo's label, description and signature, or the words someone typed.
export interface Seen {
  label: string;
  description: string;
  thumbnail: string;
  signature?: number[];
  startedAt: number;
}

export async function see(input: WakeInput): Promise<Seen> {
  const startedAt = performance.now();
  // The LLM first, while memory is cleanest: it is by far the largest allocation (ADR 0016).
  const llmReady = ensureLlm();
  if (input.kind === 'words') {
    const label = input.label.trim();
    return { label, description: input.description.trim() || `A ${label}.`, thumbnail: '', startedAt };
  }
  await llmReady;
  const vision = await ensureVision();
  const sight = await look(vision, input.crop);
  return {
    label: sight.label ?? 'thing',
    description: sight.description,
    thumbnail: input.thumbnail,
    signature: compactSignature(vision.embed(input.crop)),
    startedAt,
  };
}

// The soul this photo shows, if it already woke up. Souls from before signatures existed get theirs from
// their saved photo the first time they are compared.
export async function recognise(seen: Seen, souls: readonly Soul[]): Promise<Match | null> {
  if (!seen.signature) return null;
  const vision = await ensureVision();
  const withSignatures = await Promise.all(souls.map(soul => withSignature(vision, soul)));
  logSimilarities(seen.signature, withSignatures);
  return bestMatch(seen.signature, seen.label, withSignatures);
}

async function withSignature(vision: VisionBackend, soul: Soul): Promise<Soul> {
  if (soul.signature?.length || !soul.thumbnail) return soul;
  try {
    const next = { ...soul, signature: compactSignature(vision.embed(await loadImage(soul.thumbnail))) };
    await saveSoul(next);
    return next;
  } catch (e) {
    log(`No signature for ${soul.name}: ${(e as Error).message}`);
    return soul;
  }
}

export async function awaken(seen: Seen, onProgress: (p: WakeProgress) => void): Promise<Soul> {
  onProgress({ step: 'soul', description: seen.description });
  const profile = await createSoul(await ensureLlm(), seen.label, seen.description);
  onProgress({ step: 'hello', description: seen.description });
  const now = Date.now();
  const soul: Soul = {
    ...profile,
    id: newSoulId(),
    label: seen.label,
    description: seen.description,
    thumbnail: seen.thumbnail,
    ...(seen.signature ? { signature: seen.signature } : {}),
    memory: '',
    history: [{ role: 'assistant', content: profile.greeting, at: now }],
    createdAt: now,
    lastTalkedAt: now,
  };
  await saveSoul(soul);
  record('wake.total', performance.now() - seen.startedAt);
  return soul;
}
