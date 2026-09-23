// Small app settings kept in IndexedDB.
import { dbGet, dbPut } from './db';

export interface Settings {
  // The first-run screen was completed (the LLM downloaded once).
  onboarded: boolean;
  // Replies are spoken aloud; off makes the app quiet, text only.
  speak: boolean;
}

const DEFAULTS: Settings = { onboarded: false, speak: true };

export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULTS, ...((await dbGet<Partial<Settings>>('settings', 'app')) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await dbPut('settings', 'app', next);
  return next;
}
