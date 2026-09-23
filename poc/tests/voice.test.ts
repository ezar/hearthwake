import { describe, expect, it } from 'vitest';
import { hashName, sentenceSplitter } from '../src/voice';

const feed = (chunks: string[]) => {
  const s = sentenceSplitter();
  const out = chunks.flatMap(c => s.push(c));
  return { out, rest: s.flush() };
};

describe('sentenceSplitter', () => {
  it('waits for whitespace after the terminal punctuation', () => {
    const s = sentenceSplitter();
    expect(s.push('Hola.')).toEqual([]);
    expect(s.push(' Soy la tetera')).toEqual(['Hola.']);
    expect(s.flush()).toEqual(['Soy la tetera']);
  });

  it('handles partial sentences across many deltas', () => {
    const { out, rest } = feed(['¡Qué ', 'frío ha', 'ce aquí', '! ¿Me ', 'oyes? Bien']);
    expect(out).toEqual(['¡Qué frío hace aquí!', '¿Me oyes?']);
    expect(rest).toEqual(['Bien']);
  });

  it('treats ellipsis, both as a character and as dots, as terminal', () => {
    expect(feed(['Mmm… vale. Bueno... sí. ']).out).toEqual(['Mmm…', 'vale.', 'Bueno...', 'sí.']);
  });

  it('keeps runs of punctuation together', () => {
    expect(feed(['¿¡En serio?! ', 'Increíble!!! Ya.']).out).toEqual(['¿¡En serio?!', 'Increíble!!!']);
  });

  it('does not split decimals or abbreviations without a following space', () => {
    expect(feed(['Mido 3.5 metros. ']).out).toEqual(['Mido 3.5 metros.']);
  });

  it('includes closing quotes in the sentence', () => {
    expect(feed(['Dijo «¡basta!» y se fue. ']).out).toEqual(['Dijo «¡basta!»', 'y se fue.']);
  });

  it('flushes the remainder once and resets', () => {
    const s = sentenceSplitter();
    s.push('Sin punto final');
    expect(s.flush()).toEqual(['Sin punto final']);
    expect(s.flush()).toEqual([]);
  });

  it('ignores whitespace-only input', () => {
    const { out, rest } = feed(['  ', '\n']);
    expect(out).toEqual([]);
    expect(rest).toEqual([]);
  });
});

describe('hashName', () => {
  it('is deterministic and unsigned', () => {
    expect(hashName('Tetera Tomasa')).toBe(hashName('Tetera Tomasa'));
    expect(hashName('Lámpara Lola')).toBeGreaterThanOrEqual(0);
    expect(hashName('a')).not.toBe(hashName('b'));
  });
});
