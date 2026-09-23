// On-screen log, timing collection and the JSON report. Everything stays on the device.
// The log and timings are mirrored to localStorage, and every heavy step leaves an activity marker,
// so a tab killed by iOS for lack of memory can be detected and reported on the next visit.
const VISIBLE_LINES = 200;
const REPORT_LINES = 120;
const MAX_EVENTS = 1000;
const MAX_SAMPLES = 500;
const QUIET_PERSIST_MS = 2000;
export const REPORT_KEY = 'hearthwake.poc.report';
export const ACTIVITY_KEY = 'hearthwake.poc.activity';

export interface Activity {
  label: string;
  model?: string;
  at: string;
}

const timings: Record<string, number[]> = {};
const events: string[] = [];
let logEl: HTMLElement | null = null;
let previousCrash: Activity | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// localStorage can be missing (tests) or full; losing the mirror must never break the harness.
function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota errors are ignored; the in-memory log is still complete.
  }
}

function remove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Ignored, as above.
  }
}

function persist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  writeJson(REPORT_KEY, { events: events.slice(-VISIBLE_LINES), timings });
}

// Marks the start of a step that may exhaust memory. Written synchronously, before the step runs.
export function beginActivity(label: string, model?: string): void {
  writeJson(ACTIVITY_KEY, { label, model, at: new Date().toISOString() } satisfies Activity);
}

export function endActivity(): void {
  remove(ACTIVITY_KEY);
}

// Call once at startup. If the last session died mid-activity, its log and timings are restored
// and the activity is returned; otherwise the saved mirror is discarded and a fresh session starts.
export function restoreAfterCrash(): Activity | null {
  const activity = readJson<Activity>(ACTIVITY_KEY);
  const saved = readJson<{ events?: string[]; timings?: Record<string, number[]> }>(REPORT_KEY);
  remove(ACTIVITY_KEY);
  if (!activity) {
    remove(REPORT_KEY);
    return null;
  }
  previousCrash = activity;
  events.push(...(saved?.events ?? []), '--- previous session ended here ---');
  for (const [name, values] of Object.entries(saved?.timings ?? {})) (timings[name] ??= []).push(...values);
  log(`Previous session closed during "${activity.label}" (started ${activity.at}), probably out of memory`);
  return activity;
}

export function initLog(el: HTMLElement): void {
  logEl = el;
}

export function log(message: string): void {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  events.push(line);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  console.log(line);
  persist();
  if (logEl) {
    logEl.textContent = events.slice(-VISIBLE_LINES).join('\n');
    logEl.scrollTop = logEl.scrollHeight;
  }
}

// Stores a duration; quiet ones (per-frame timings) skip the visible log.
export function record(name: string, ms: number, quiet = false): void {
  const samples = (timings[name] ??= []);
  samples.push(Math.round(ms));
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
  if (!quiet) log(`${name}: ${Math.round(ms)} ms`);
  else persistTimer ??= setTimeout(persist, QUIET_PERSIST_MS);
}

export async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    record(name, performance.now() - start);
  }
}

export interface Stats {
  count: number;
  median: number;
  min: number;
  max: number;
}

export function stats(values: readonly number[]): Stats | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const median = s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  return { count: s.length, median, min: s[0]!, max: s[s.length - 1]! };
}

export function summarize(source: Record<string, number[]> = timings): Record<string, Stats | null> {
  return Object.fromEntries(Object.entries(source).map(([k, v]) => [k, stats(v)]));
}

export function buildReport(probe: unknown, models: Record<string, string | null>) {
  return {
    timestamp: new Date().toISOString(),
    probe,
    models,
    previousCrash,
    timings: summarize(),
    log: events.slice(-REPORT_LINES),
  };
}
