import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PENDING_KEY,
  clearPending,
  loadPending,
  pendingStep,
  savePending,
  type PendingWake,
} from '../src/pending';

const wake: PendingWake = {
  label: 'radiator',
  thumbnail: 'data:image/jpeg;base64,AAAA',
  description: null,
  llm: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  startedAt: 1,
};

describe('pending wake', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('survives a reload and moves from describe to soul', () => {
    expect(loadPending()).toBeNull();
    expect(savePending(wake)).toBe(true);
    expect(pendingStep(loadPending()!)).toBe('describe');
    savePending({ ...wake, description: 'A white aluminium radiator.' });
    expect(pendingStep(loadPending()!)).toBe('soul');
    clearPending();
    expect(loadPending()).toBeNull();
  });

  it('ignores malformed entries', () => {
    store.set(PENDING_KEY, '{not json');
    expect(loadPending()).toBeNull();
    store.set(PENDING_KEY, JSON.stringify({ ...wake, thumbnail: 'javascript:alert(1)' }));
    expect(loadPending()).toBeNull();
    store.set(PENDING_KEY, JSON.stringify({ ...wake, description: 42 }));
    expect(loadPending()).toBeNull();
  });

  it('reports a full storage instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(savePending(wake)).toBe(false);
  });
});
