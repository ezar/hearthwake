// Waking a thing: look at it, give it a soul, save it. The Wake and Describe screens hand over what they
// captured; the Waking screen runs the steps and shows them.
import { newSoulId, saveSoul, type Soul } from '../store/souls';
import { ensureLlm, ensureVision } from './engine';
import { createSoul } from './llm';
import { record } from './metrics';
import { look } from './vision';

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

export interface WakeProgress {
  step: WakeStep;
  description?: string;
}

export async function wake(input: WakeInput, onProgress: (p: WakeProgress) => void): Promise<Soul> {
  const start = performance.now();
  onProgress({ step: 'look' });
  // The LLM first, while memory is cleanest: it is by far the largest allocation (ADR 0016).
  const llmReady = ensureLlm();
  let label: string;
  let description: string;
  let thumbnail = '';
  if (input.kind === 'photo') {
    await llmReady;
    const vision = await ensureVision();
    const sight = await look(vision, input.crop);
    label = sight.label ?? 'thing';
    description = sight.description;
    thumbnail = input.thumbnail;
  } else {
    label = input.label.trim();
    description = input.description.trim() || `A ${label}.`;
  }
  onProgress({ step: 'soul', description });
  const profile = await createSoul(await llmReady, label, description);
  onProgress({ step: 'hello', description });
  const now = Date.now();
  const soul: Soul = {
    ...profile,
    id: newSoulId(),
    label,
    description,
    thumbnail,
    memory: '',
    history: [{ role: 'assistant', content: profile.greeting, at: now }],
    createdAt: now,
    lastTalkedAt: now,
  };
  await saveSoul(soul);
  record('wake.total', performance.now() - start);
  return soul;
}
