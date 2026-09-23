// Timings and a short event log, for the diagnostics report in Settings. Everything stays on the device.
// Heavy steps also leave an activity marker in localStorage, so a tab killed by iOS for lack of memory
// can be noticed on the next visit (ADR 0006).
const MAX_EVENTS = 200;
const MAX_SAMPLES = 100;
export const ACTIVITY_KEY = 'hearthwake.app.activity';

const timings: Record<string, number[]> = {};
const events: string[] = [];

export function log(message: string): void {
  events.push(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  if (import.meta.env?.DEV) console.info(message);
}

export function record(name: string, ms: number): void {
  const samples = (timings[name] ??= []);
  samples.push(Math.round(ms));
  if (samples.length > MAX_SAMPLES) samples.shift();
  log(`${name}: ${Math.round(ms)} ms`);
}

export async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    record(name, performance.now() - start);
  }
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function snapshot() {
  return {
    timings: Object.fromEntries(
      Object.entries(timings).map(([k, v]) => [k, { count: v.length, median: median(v), last: v.at(-1) }]),
    ),
    log: [...events],
  };
}

// Activity markers.
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const active = new Map<number, string>();
let nextId = 1;

function writeActive(): void {
  try {
    if (active.size) storage()?.setItem(ACTIVITY_KEY, JSON.stringify([...active.values()]));
    else storage()?.removeItem(ACTIVITY_KEY);
  } catch {
    // Quota or privacy mode: crash detection is best effort.
  }
}

export async function withActivity<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const id = nextId++;
  active.set(id, label);
  writeActive();
  try {
    return await fn();
  } finally {
    active.delete(id);
    writeActive();
  }
}

// Call once at startup: what was running when the last visit ended, if it ended abruptly.
export function takeInterruptedActivities(): string[] {
  try {
    const raw = storage()?.getItem(ACTIVITY_KEY);
    storage()?.removeItem(ACTIVITY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === 'string') : [];
  } catch {
    return [];
  }
}
