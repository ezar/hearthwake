import { describe, expect, it } from 'vitest';
import { PITCHES, RATES, SOUL_FIELD_LIMITS, SOUL_GRAMMAR } from '../src/soul-grammar';

// The grammar itself was checked against XGrammar's isGrammarAcceptString (ADR 0013); these tests pin
// the properties that keep generation bounded.
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

  it('bounds every string and asks for 3 to 5 traits', () => {
    for (const n of new Set(Object.values(SOUL_FIELD_LIMITS))) {
      expect(SOUL_GRAMMAR).toContain(`s${n} ::= "\\"" [^"\\\\\\r\\n]{1,${n}} "\\""`);
    }
    expect(root).toContain(`",\\"traits\\":[" s20 ("," s20){2,4} "]"`);
  });

  it('offers the voice as words, not numbers', () => {
    expect(SOUL_GRAMMAR).toContain('pitch ::= "\\"low\\"" | "\\"medium\\"" | "\\"high\\""');
    expect(SOUL_GRAMMAR).toContain('rate ::= "\\"slow\\"" | "\\"normal\\"" | "\\"fast\\""');
    expect(Object.values(PITCHES).every(v => v >= 0.6 && v <= 1.6)).toBe(true);
    expect(Object.values(RATES).every(v => v >= 0.8 && v <= 1.2)).toBe(true);
  });
});
