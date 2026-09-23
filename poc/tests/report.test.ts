import { describe, expect, it } from 'vitest';
import { stats, summarize } from '../src/report';

describe('stats', () => {
  it('returns null for no samples', () => {
    expect(stats([])).toBeNull();
  });

  it('computes count, median, min and max for odd counts', () => {
    expect(stats([30, 10, 20])).toEqual({ count: 3, median: 20, min: 10, max: 30 });
  });

  it('averages the middle pair for even counts', () => {
    expect(stats([4, 1, 3, 2])).toEqual({ count: 4, median: 2.5, min: 1, max: 4 });
  });

  it('does not mutate the input', () => {
    const values = [3, 1, 2];
    stats(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('summarize', () => {
  it('summarizes every metric', () => {
    expect(summarize({ 'wake.total': [9000, 11000], 'llm.firstToken': [400] })).toEqual({
      'wake.total': { count: 2, median: 10000, min: 9000, max: 11000 },
      'llm.firstToken': { count: 1, median: 400, min: 400, max: 400 },
    });
  });
});
