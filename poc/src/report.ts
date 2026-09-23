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
let previousCrash: Activity[] | null = null;
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

// Activities are steps that may exhaust memory. Several can run at once (detection keeps running
// while a model loads), so the marker holds all of them. It is written synchronously before each step.
const active = new Map<number, Activity>();
let nextActivity = 1;

function writeActivities(): void {
  if (active.size) writeJson(ACTIVITY_KEY, [...active.values()]);
  else remove(ACTIVITY_KEY);
}

export function beginActivity(label: string, model?: string): number {
  const id = nextActivity++;
  active.set(id, { label, model, at: new Date().toISOString() });
  writeActivities();
  return id;
}

export function endActivity(id: number): void {
  active.delete(id);
  writeActivities();
}

// Call once at startup. If the last session died mid-activity, its log and timings are restored
// and the activities are returned; otherwise the saved mirror is discarded and a fresh session starts.
// keepLog: the page reloaded on purpose (a two-step wake), so its log and timings carry over too.
export function restoreAfterCrash(keepLog = false): Activity[] | null {
  const stored = readJson<Activity | Activity[]>(ACTIVITY_KEY);
  const activities = stored ? (Array.isArray(stored) ? stored : [stored]) : [];
  const saved = readJson<{ events?: string[]; timings?: Record<string, number[]> }>(REPORT_KEY);
  remove(ACTIVITY_KEY);
  if (!activities.length) {
    if (keepLog && saved) {
      events.push(...(saved.events ?? []), '--- page reloaded to continue a wake ---');
      for (const [name, values] of Object.entries(saved.timings ?? {}))
        (timings[name] ??= []).push(...values);
    } else {
      remove(REPORT_KEY);
    }
    return null;
  }
  previousCrash = activities;
  events.push(...(saved?.events ?? []), '--- previous session ended here ---');
  for (const [name, values] of Object.entries(saved?.timings ?? {})) (timings[name] ??= []).push(...values);
  const what = activities.map(a => `"${a.label}" (started ${a.at})`).join(' and ');
  log(`Previous session closed during ${what}, probably out of memory`);
  return activities;
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
