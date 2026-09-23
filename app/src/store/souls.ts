// Souls: the things that have woken up. Kept in IndexedDB and mirrored in memory for the UI.
import { useSyncExternalStore } from 'react';
import { dbDelete, dbGet, dbGetAll, dbPut } from './db';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  at?: number;
}

export interface SoulProfile {
  name: string;
  title: string;
  archetype: string;
  traits: string[];
  style: string;
  catchphrase: string;
  secret: string;
  pitch: number;
  rate: number;
  greeting: string;
}

export interface Soul extends SoulProfile {
  id: string;
  // What the thing is ("sliding door") and how it looks ("An orange and grey sliding door.").
  label: string;
  description: string;
  // A small JPEG data URL of the photo, or '' for things woken from a description.
  thumbnail: string;
  // The running summary of older conversations, and the recent messages kept word for word.
  memory: string;
  history: ChatMessage[];
  createdAt: number;
  lastTalkedAt: number;
}

let cache: Soul[] | null = null;
const listeners = new Set<() => void>();

const byRecent = (a: Soul, b: Soul) => b.lastTalkedAt - a.lastTalkedAt;

function publish(next: Soul[]): void {
  cache = [...next].sort(byRecent);
  for (const listener of listeners) listener();
}

export async function loadSouls(): Promise<Soul[]> {
  const all = (await dbGetAll<Soul>('souls')).map(upgrade);
  publish(all);
  return cache!;
}

// Souls saved by the M0 spike have no lastTalkedAt.
function upgrade(soul: Soul): Soul {
  return { ...soul, lastTalkedAt: soul.lastTalkedAt ?? soul.createdAt, history: soul.history ?? [] };
}

export const getSoul = (id: string): Soul | null => cache?.find(s => s.id === id) ?? null;

export async function saveSoul(soul: Soul): Promise<void> {
  await dbPut('souls', soul.id, soul);
  publish([...(cache ?? []).filter(s => s.id !== soul.id), soul]);
}

export async function forgetSoul(id: string): Promise<void> {
  await dbDelete('souls', id);
  publish((cache ?? []).filter(s => s.id !== id));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// null while the database is still being read.
export function useSouls(): Soul[] | null {
  return useSyncExternalStore(subscribe, () => cache);
}

// The M0 spike kept its souls in localStorage on the same origin; bring them over once.
export const POC_SOULS_KEY = 'hearthwake.poc.souls';

export async function importPocSouls(storage: Pick<Storage, 'getItem'> = localStorage): Promise<number> {
  if (await dbGet<boolean>('settings', 'pocImported')) return 0;
  let imported = 0;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(POC_SOULS_KEY) ?? '{}');
    const souls = parsed && typeof parsed === 'object' ? Object.values(parsed as Record<string, Soul>) : [];
    for (const soul of souls) {
      if (!soul?.id || !soul.name || (await dbGet('souls', soul.id))) continue;
      await dbPut('souls', soul.id, upgrade(soul));
      imported++;
    }
  } catch {
    // A damaged PoC record is not worth blocking the app for.
  }
  await dbPut('settings', 'pocImported', true);
  return imported;
}

export function newSoulId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
