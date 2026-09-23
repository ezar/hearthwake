import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasSystemRecognition, startListening, STOP_TIMEOUT_MS, stopListening } from '../src/voice';

type Result = { isFinal: boolean; 0: { transcript: string } };

// A stand-in for the browser's recognizer: results are pushed by the test, and stop() ends it.
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = '';
  continuous = false;
  interimResults = true;
  onresult: ((e: { resultIndex: number; results: Result[] }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  results: Result[] = [];
  constructor() {
    FakeRecognition.last = this;
  }
  start() {}
  endsOnStop = true;
  aborted = false;
  stop() {
    if (this.endsOnStop) queueMicrotask(() => this.onend?.());
  }
  abort() {
    this.aborted = true;
  }
  hear(transcript: string, isFinal = true) {
    const resultIndex = this.results.length;
    this.results.push({ isFinal, 0: { transcript } });
    this.onresult?.({ resultIndex, results: this.results });
  }
}

const g = globalThis as { webkitSpeechRecognition?: unknown };

afterEach(() => {
  delete g.webkitSpeechRecognition;
  vi.useRealTimers();
});

describe('system speech recognition', () => {
  it('reports whether the browser has it', () => {
    expect(hasSystemRecognition()).toBe(false);
    g.webkitSpeechRecognition = FakeRecognition;
    expect(hasSystemRecognition()).toBe(true);
  });

  it('joins the final results heard between press and release', async () => {
    g.webkitSpeechRecognition = FakeRecognition;
    startListening();
    const r = FakeRecognition.last!;
    expect(r.lang).toBe('en-US');
    r.hear('Hello there');
    r.hear('how are', false);
    r.hear('How are you?');
    await expect(stopListening()).resolves.toBe('Hello there How are you?');
  });

  it('treats silence as nothing heard, and other errors as failures', async () => {
    g.webkitSpeechRecognition = FakeRecognition;
    startListening();
    FakeRecognition.last!.onerror?.({ error: 'no-speech' });
    await expect(stopListening()).resolves.toBe('');
    startListening();
    FakeRecognition.last!.onerror?.({ error: 'not-allowed' });
    await expect(stopListening()).rejects.toThrow('not-allowed');
  });

  it('gives up waiting when the recognizer never ends, keeping what it heard', async () => {
    vi.useFakeTimers();
    g.webkitSpeechRecognition = FakeRecognition;
    startListening();
    const r = FakeRecognition.last!;
    r.endsOnStop = false;
    r.hear('Hello');
    const text = stopListening();
    await vi.advanceTimersByTimeAsync(STOP_TIMEOUT_MS);
    await expect(text).resolves.toBe('Hello');
    expect(r.aborted).toBe(true);
  });
});
