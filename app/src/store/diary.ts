// The Lab's private diary: entries kept in IndexedDB on this device only.
import { useSyncExternalStore } from 'react';
import { dbDelete, dbGetAll, dbPut } from './db';

export interface DiaryEntry {
  id: string;
  at: number;
  text: string;
}

let cache: DiaryEntry[] | null = null;
const listeners = new Set<() => void>();

function publish(next: DiaryEntry[]): void {
  cache = [...next].sort((a, b) => a.at - b.at);
  for (const l of listeners) l();
}

export async function loadDiary(): Promise<DiaryEntry[]> {
  publish(await dbGetAll<DiaryEntry>('diary'));
  return cache!;
}

export async function addEntry(text: string, at = Date.now()): Promise<DiaryEntry> {
  const entry = { id: `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, at, text: text.trim() };
  await dbPut('diary', entry.id, entry);
  publish([...(cache ?? []), entry]);
  return entry;
}

export async function deleteEntry(id: string): Promise<void> {
  await dbDelete('diary', id);
  publish((cache ?? []).filter(e => e.id !== id));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useDiary = () => useSyncExternalStore(subscribe, () => cache);
