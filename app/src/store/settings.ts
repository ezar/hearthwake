// Small app settings kept in IndexedDB.
import { defaultLang, type Lang } from '../i18n';
import { dbGet, dbPut } from './db';

export interface Settings {
  // The first-run screen was completed (the LLM downloaded once).
  onboarded: boolean;
  // Replies are spoken aloud; off makes the app quiet, text only.
  speak: boolean;
  // Interface and soul language; the browser's language decides the first time (ADR 0023).
  lang: Lang;
  // Which language model to use (a key of MODELS).
  model: string;
}

const defaults = (): Settings => ({ onboarded: false, speak: true, lang: defaultLang(), model: 'llama-1b' });

export async function loadSettings(): Promise<Settings> {
  return { ...defaults(), ...((await dbGet<Partial<Settings>>('settings', 'app')) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await dbPut('settings', 'app', next);
  return next;
}
