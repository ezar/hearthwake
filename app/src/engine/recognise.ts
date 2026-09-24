// Recognising a thing that already woke up: the new photo's signature is compared with each soul's.
// The thresholds are a first guess, to be tuned from the similarities logged on real devices (ADR 0021);
// a match is always confirmed by the person, so a wrong guess costs one tap.
import type { Soul } from '../store/souls';
import { log } from './metrics';
import { similarity } from './vision';

// Similar enough on its own, or with the same classifier label.
export const MATCH_AT = 0.8;
export const MATCH_SAME_LABEL_AT = 0.7;

export interface Match {
  soul: Soul;
  score: number;
}

export function bestMatch(
  signature: readonly number[],
  label: string | null,
  souls: readonly Soul[],
): Match | null {
  let best: Match | null = null;
  for (const soul of souls) {
    if (!soul.signature?.length) continue;
    const score = similarity(signature, soul.signature);
    const needed = label && soul.label === label ? MATCH_SAME_LABEL_AT : MATCH_AT;
    if (score >= needed && (!best || score > best.score)) best = { soul, score };
  }
  return best;
}

export function logSimilarities(signature: readonly number[], souls: readonly Soul[]): void {
  const scores = souls
    .filter(s => s.signature?.length)
    .map(s => `${s.name} ${similarity(signature, s.signature!).toFixed(2)}`);
  if (scores.length) log(`Similarity: ${scores.join(', ')}`);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read a saved photo'));
    img.src = src;
  });
}
