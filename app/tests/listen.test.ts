import { afterEach, describe, expect, it, vi } from 'vitest';
import { canHear, listen, STOP_TIMEOUT_MS } from '../src/engine/voice';

type Result = { isFinal: boolean; 0: { transcript: string } };

// A stand-in for the browser's recognizer: results are pushed by the test, and stop() ends it.
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: { resultIndex: number; results: Result[] }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  results: Result[] = [];
  endsOnStop = true;
  aborted = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {}
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

describe('listen', () => {
  it('knows whether the browser can hear', () => {
    expect(canHear()).toBe(false);
    g.webkitSpeechRecognition = FakeRecognition;
    expect(canHear()).toBe(true);
  });

  it('joins final results and reports partial ones as captions', async () => {
    g.webkitSpeechRecognition = FakeRecognition;
    const partials: string[] = [];
    const l = listen(p => partials.push(p));
    const r = FakeRecognition.last!;
    expect(r.lang).toBe('en-US');
    expect(r.interimResults).toBe(true);
    r.hear('Hello there');
    r.hear('how are', false);
    r.hear('How are you?');
    expect(partials).toEqual(['Hello there', 'Hello there how are', 'Hello there How are you?']);
    await expect(l.stop()).resolves.toBe('Hello there How are you?');
  });

  it('treats silence as nothing heard, and a refusal as a clear error', async () => {
    g.webkitSpeechRecognition = FakeRecognition;
    let l = listen();
    FakeRecognition.last!.onerror?.({ error: 'no-speech' });
    await expect(l.stop()).resolves.toBe('');
    l = listen();
    FakeRecognition.last!.onerror?.({ error: 'not-allowed' });
    await expect(l.stop()).rejects.toThrow('not allowed to listen');
  });

  it('gives up waiting when the recognizer never ends, keeping what it heard', async () => {
    vi.useFakeTimers();
    g.webkitSpeechRecognition = FakeRecognition;
    const l = listen();
    const r = FakeRecognition.last!;
    r.endsOnStop = false;
    r.hear('Hello');
    const text = l.stop();
    await vi.advanceTimersByTimeAsync(STOP_TIMEOUT_MS);
    await expect(text).resolves.toBe('Hello');
    expect(r.aborted).toBe(true);
  });
});
