// Timing collection and on-screen log. Everything stays on the device.
const timings = {};
const events = [];
let logEl = null;

export function initLog(el) { logEl = el; }

export function log(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  events.push(line);
  console.log(line);
  if (logEl) {
    logEl.textContent = events.slice(-200).join('\n');
    logEl.scrollTop = logEl.scrollHeight;
  }
}

export function record(name, ms, quiet = false) {
  (timings[name] ??= []).push(Math.round(ms));
  if (!quiet) log(`${name}: ${Math.round(ms)} ms`);
}

export async function timed(name, fn) {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    record(name, performance.now() - start);
  }
}

function stats(values) {
  const s = [...values].sort((a, b) => a - b);
  return { n: s.length, median: s[Math.floor(s.length / 2)], min: s[0], max: s.at(-1) };
}

export function buildReport(probe, models) {
  const summary = Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, stats(v)]));
  return { at: new Date().toISOString(), probe, models, timings: summary, log: events.slice(-120) };
}
