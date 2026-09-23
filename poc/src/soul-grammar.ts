// EBNF grammar for the soul JSON, passed to WebLLM as `response_format: { type: 'grammar' }` (ADR 0013).
//
// WebLLM compiles JSON schemas with unlimited whitespace between tokens and unbounded number digits. On
// the iPhone, Llama 3.2 1B spent a 512-token budget on 872 characters, so it ran out of tokens anyway.
// This grammar allows no free whitespace, bounds every string, and makes the voice a choice of words.

export const SOUL_FIELD_LIMITS = {
  name: 30,
  title: 40,
  archetype: 40,
  trait: 20,
  style: 80,
  catchphrase: 60,
  secret: 80,
  greeting: 140,
} as const;

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
      `",\\"traits\\":[" s${L.trait} ("," s${L.trait}){2,4} "]"`,
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
