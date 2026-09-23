// EBNF grammar for the soul JSON, passed to WebLLM as `response_format: { type: 'grammar' }` (ADR 0013).
//
// WebLLM compiles JSON schemas with unlimited whitespace and unbounded digits, and on the iPhone Llama 3.2
// 1B ran out of tokens anyway. This grammar allows no free whitespace, bounds every string and makes the
// voice a choice of words. The app's limits are tighter than the spike's, since every character is time:
// a soul took about 18 s on the iPhone against a 12 s target (ADR 0019).

export const SOUL_FIELD_LIMITS = {
  name: 24,
  title: 36,
  archetype: 28,
  trait: 16,
  style: 60,
  catchphrase: 40,
  secret: 60,
  greeting: 130,
} as const;

export const MIN_TRAITS = 3;
export const MAX_TRAITS = 4;

export const PITCHES = { low: 0.75, medium: 1, high: 1.35 } as const;
export const RATES = { slow: 0.85, normal: 1, fast: 1.15 } as const;

const L = SOUL_FIELD_LIMITS;
const choice = (words: object) =>
  Object.keys(words)
    .map(w => `"\\"${w}\\""`)
    .join(' | ');

// Strings are 1 to n characters with no quotes, backslashes or line breaks, so no escapes are needed.
export const SOUL_GRAMMAR = [
  'root ::= "{" ' +
    [
      `"\\"name\\":" s${L.name}`,
      `",\\"title\\":" s${L.title}`,
      `",\\"archetype\\":" s${L.archetype}`,
      `",\\"traits\\":[" s${L.trait} ("," s${L.trait}){${MIN_TRAITS - 1},${MAX_TRAITS - 1}} "]"`,
      `",\\"style\\":" s${L.style}`,
      `",\\"catchphrase\\":" s${L.catchphrase}`,
      `",\\"secret\\":" s${L.secret}`,
      `",\\"pitch\\":" pitch`,
      `",\\"rate\\":" rate`,
      `",\\"greeting\\":" s${L.greeting}`,
    ].join(' ') +
    ' "}"',
  ...[...new Set(Object.values(L))].map(n => `s${n} ::= "\\"" [^"\\\\\\r\\n]{1,${n}} "\\""`),
  `pitch ::= ${choice(PITCHES)}`,
  `rate ::= ${choice(RATES)}`,
].join('\n');
