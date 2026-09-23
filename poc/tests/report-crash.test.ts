import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

// Each import is a fresh page load; the storage stub survives between them like localStorage does.
const pageLoad = async () => {
  vi.resetModules();
  return import('../src/report');
};

describe('crash detection', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts fresh when the last session ended cleanly', async () => {
    const first = await pageLoad();
    first.record('load.detector', 1200);
    first.beginActivity('load detector');
    first.endActivity();

    const second = await pageLoad();
    expect(second.restoreAfterCrash()).toBeNull();
    const report = second.buildReport(null, {});
    expect(report.previousCrash).toBeNull();
    expect(report.timings).toEqual({});
    expect(storage.getItem(second.REPORT_KEY)).toBeNull();
  });

  it('restores the log and timings of a session killed mid-activity', async () => {
    const first = await pageLoad();
    first.record('load.detector', 1200);
    first.beginActivity('load llm Qwen2.5-1.5B-Instruct-q4f16_1-MLC', 'llm');
    // The tab dies here: endActivity never runs.

    const second = await pageLoad();
    const crash = second.restoreAfterCrash();
    expect(crash).toMatchObject({ label: 'load llm Qwen2.5-1.5B-Instruct-q4f16_1-MLC', model: 'llm' });

    const report = second.buildReport(null, {});
    expect(report.previousCrash).toEqual(crash);
    expect(report.timings['load.detector']).toMatchObject({ count: 1, median: 1200 });
    expect(report.log.join('\n')).toContain('load.detector: 1200 ms');
    expect(report.log.join('\n')).toContain('previous session ended here');

    // Reported once: a later clean reload starts fresh again.
    const third = await pageLoad();
    expect(third.restoreAfterCrash()).toBeNull();
  });

  it('keeps working when storage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    });
    const page = await pageLoad();
    expect(() => page.beginActivity('wake')).not.toThrow();
    expect(page.restoreAfterCrash()).toBeNull();
    page.record('wake.total', 9000);
    expect(page.buildReport(null, {}).timings['wake.total']).toMatchObject({ count: 1 });
  });
});
