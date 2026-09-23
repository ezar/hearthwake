// Souls persisted in localStorage as a map by id (IndexedDB comes in M1).
import { log } from './report';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
  label: string;
  description: string;
  thumbnail: string;
  memory: string;
  history: ChatMessage[];
  createdAt: number;
}

export const STORAGE_KEY = 'hearthwake.poc.souls';

function readAll(): Record<string, Soul> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Soul>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Soul>): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    log(`Could not persist souls: ${(e as Error).message}`);
    return false;
  }
}

export const listSouls = (): Soul[] => Object.values(readAll()).sort((a, b) => b.createdAt - a.createdAt);

export const getSoul = (id: string): Soul | null => readAll()[id] ?? null;

export function saveSoul(soul: Soul): boolean {
  const all = readAll();
  all[soul.id] = soul;
  return writeAll(all);
}

export function forgetSoul(id: string): boolean {
  const all = readAll();
  delete all[id];
  return writeAll(all);
}
