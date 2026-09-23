// A wake that continues after a page reload (ADR 0014). On the iPhone, vision and the LLM cannot share one
// page load: freeing vision does not give its memory back in time, and the tab dies when the LLM generates.
// So the camera page saves the crop (and the description, if vision could run there) and reloads; the
// fresh page describes the crop if needed, reloads again, and finally creates the soul with the LLM.

export const PENDING_KEY = 'hearthwake.poc.pendingWake';

export interface PendingWake {
  label: string;
  // JPEG data URL of the crop; also the soul's thumbnail.
  thumbnail: string;
  // Null until vision has described the crop.
  description: string | null;
  // LLM chosen on the camera page, so the soul page loads the same one.
  llm: string;
  startedAt: number;
}

export function loadPending(): PendingWake | null {
  try {
    const raw = globalThis.localStorage?.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PendingWake>;
    const valid =
      typeof p.label === 'string' &&
      typeof p.thumbnail === 'string' &&
      p.thumbnail.startsWith('data:image/') &&
      (p.description === null || typeof p.description === 'string') &&
      typeof p.llm === 'string' &&
      typeof p.startedAt === 'number';
    return valid ? (p as PendingWake) : null;
  } catch {
    return null;
  }
}

export function savePending(pending: PendingWake): boolean {
  try {
    globalThis.localStorage?.setItem(PENDING_KEY, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

export function clearPending(): void {
  try {
    globalThis.localStorage?.removeItem(PENDING_KEY);
  } catch {
    // Nothing else to do; a stale entry is shown with a Cancel button.
  }
}

export const pendingStep = (p: PendingWake): 'describe' | 'soul' =>
  p.description === null ? 'describe' : 'soul';
