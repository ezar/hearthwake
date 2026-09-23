# 0013. Generate souls with a hand-written grammar, no example, one retry

Status: accepted, M0. Supersedes the JSON-schema and worked-example parts of ADR 0011.

## Context

With the bounded JSON schema and the umbrella example (ADR 0011 amendment), Llama 3.2 1B on the iPhone:

- finished 3 of 4 souls, taking 5.7 to 13.4 s;
- ran out of tokens on the fourth: `finish=length`, 511 tokens for 872 characters.

WebLLM compiles a JSON schema with XGrammar allowing unlimited whitespace between JSON tokens, and number rules allow unlimited digits. Either lets the model spend tokens without adding content, which a 512-token budget cannot absorb.

The model also kept copying the example. "Batten down the hatches, indeed." came from Captain Drizzle, despite the instruction not to reuse it. It still did not mention the given appearance.

## Decision

- **Hand-written grammar.** Soul generation uses `response_format: { type: 'grammar' }` with the EBNF in `poc/src/soul-grammar.ts`:
  - fields in fixed order with no free whitespace;
  - every string 1 to n characters, with no quotes, backslashes or line breaks;
  - 3 to 5 traits;
  - `pitch` as `low | medium | high` and `rate` as `slow | normal | fast`, mapped to numbers in code.
  - At most about 710 characters, well under 512 tokens.
- **Checked with XGrammar.** The grammar was checked with the XGrammar bundled in WebLLM 0.2.85 (`isGrammarAcceptString`). It accepts valid souls, including accents and emoji. It rejects stray spaces or newlines, numeric pitch, 2 or 6 traits, a 141-character greeting and empty fields. Unit tests pin those properties.
- **No worked example.** The prompt lists each field with its limit instead. The appearance appears twice, in the object line and in the greeting instruction.
- **One retry.** A failed generation is retried once and logged.
- **Normalization.** Traits are lowercased. Souls saved earlier with numeric pitch and rate still load, clamped as before.

## Consequences

- Generation cannot waste tokens on whitespace or digits, so `finish=length` should no longer happen.
- Without an example, tone and quality depend on the field descriptions alone; this is the next thing to judge on the iPhone.
- Whether the greeting mentions the appearance is still up to the model; there is no check in code.
