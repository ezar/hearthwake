import { describe, expect, it } from 'vitest';
import {
  MAX_TRAITS,
  MIN_TRAITS,
  PITCHES,
  RATES,
  SOUL_FIELD_LIMITS,
  SOUL_GRAMMAR,
} from '../src/engine/grammar';

// The grammar's shape was checked against XGrammar in the spike (ADR 0013); these tests pin the
// properties that keep generation bounded.
describe('SOUL_GRAMMAR', () => {
  const root = SOUL_GRAMMAR.split('\n')[0]!;

  it('lists every field in order with no free whitespace', () => {
    const fields = [...root.matchAll(/\\"(\w+)\\":/g)].map(m => m[1]);
    expect(fields).toEqual([
      'name',
      'title',
      'archetype',
      'traits',
      'style',
      'catchphrase',
      'secret',
      'pitch',
      'rate',
      'greeting',
    ]);
    expect(SOUL_GRAMMAR).not.toMatch(/\[ \\n\\t\]|\\n\s|basic_/);
  });

  it('bounds every string and the number of traits', () => {
    for (const n of new Set(Object.values(SOUL_FIELD_LIMITS))) {
      expect(SOUL_GRAMMAR).toContain(`s${n} ::= "\\"" [^"\\\\\\r\\n]{1,${n}} "\\""`);
    }
    const t = SOUL_FIELD_LIMITS.trait;
    expect(root).toContain(`",\\"traits\\":[" s${t} ("," s${t}){${MIN_TRAITS - 1},${MAX_TRAITS - 1}} "]"`);
  });

  it('keeps the longest possible soul short', () => {
    const chars = Object.entries(SOUL_FIELD_LIMITS).reduce(
      (sum, [k, n]) => sum + (k === 'trait' ? n * MAX_TRAITS : n),
      0,
    );
    expect(chars).toBeLessThanOrEqual(480);
  });

  it('offers the voice as words, not numbers', () => {
    expect(SOUL_GRAMMAR).toContain('pitch ::= "\\"low\\"" | "\\"medium\\"" | "\\"high\\""');
    expect(SOUL_GRAMMAR).toContain('rate ::= "\\"slow\\"" | "\\"normal\\"" | "\\"fast\\""');
    expect(Object.values(PITCHES).every(v => v >= 0.6 && v <= 1.6)).toBe(true);
    expect(Object.values(RATES).every(v => v >= 0.8 && v <= 1.2)).toBe(true);
  });
});
