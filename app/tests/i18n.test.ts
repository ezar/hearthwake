import { describe, expect, it } from 'vitest';
import { MODELS } from '../src/engine/llm';
import { defaultLang, translate } from '../src/i18n';
import { ES } from '../src/i18n-es';

// Every literal passed to t(...) in the app, single- or double-quoted.
const files = import.meta.glob<string>('../src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const used = new Set(
  Object.values(files).flatMap(source =>
    [...source.matchAll(/\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)].map(m =>
      (m[1] ?? m[2]!).replace(/\\'/g, "'"),
    ),
  ),
);

describe('i18n', () => {
  it('has Spanish for every phrase the app shows', () => {
    expect(used.size).toBeGreaterThan(150);
    const missing = [...used].filter(k => !(k in ES));
    expect(missing).toEqual([]);
  });

  it('keeps the placeholders of each phrase', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const [en, es] of Object.entries(ES)) {
      // '{thing}?' drops the English article in Spanish on purpose.
      if (en === '{thing}?') continue;
      expect(names(es), en).toEqual(names(en));
    }
  });

  it('has Spanish for model notes', () => {
    for (const m of MODELS) expect(ES[m.note], m.note).toBeTruthy();
  });

  it('fills placeholders and falls back to English', () => {
    expect(translate('Talk to {name}', { name: 'Flibber' }, 'es')).toBe('Hablar con Flibber');
    expect(translate('Talk to {name}', { name: 'Flibber' }, 'en')).toBe('Talk to Flibber');
    expect(translate('Not in the dictionary', {}, 'es')).toBe('Not in the dictionary');
  });

  it("follows the browser's language the first time", () => {
    expect(defaultLang(['es-ES', 'en'])).toBe('es');
    expect(defaultLang(['en-GB'])).toBe('en');
    expect(defaultLang([])).toBe('en');
  });
});
