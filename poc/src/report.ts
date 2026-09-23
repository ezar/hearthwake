// On-screen log, timing collection and the JSON report. Everything stays on the device.
const VISIBLE_LINES = 200;
const REPORT_LINES = 120;
const MAX_EVENTS = 1000;

const timings: Record<string, number[]> = {};
const events: string[] = [];
let logEl: HTMLElement | null = null;

export function initLog(el: HTMLElement): void {
  logEl = el;
}

export function log(message: string): void {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  events.push(line);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  console.log(line);
  if (logEl) {
    logEl.textContent = events.slice(-VISIBLE_LINES).join('\n');
    logEl.scrollTop = logEl.scrollHeight;
  }
}

// Stores a duration; quiet ones (per-frame timings) skip the visible log.
export function record(name: string, ms: number, quiet = false): void {
  (timings[name] ??= []).push(Math.round(ms));
  if (!quiet) log(`${name}: ${Math.round(ms)} ms`);
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
    timings: summarize(),
    log: events.slice(-REPORT_LINES),
  };
}
