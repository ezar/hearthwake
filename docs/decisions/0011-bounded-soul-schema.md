# 0011. Bound the soul schema and show a worked example

Status: accepted, M0. Supersedes the schema-bounds part of ADR 0004. Its JSON schema and worked example are superseded by ADR 0013.

## Context

ADR 0004 left array and string bounds out of the soul's JSON schema because it was unclear whether WebLLM's grammar engine honoured them, and a rejected schema would break waking.

On the iPhone, Gemma 3 1B then looped inside the unbounded `traits` array. It wrote field-like strings ("style_description", "greeting_phrase", …) until it hit the 400-token cap (`finish=length, 399 tokens`), so the JSON never closed. Llama 3.2 1B finished, but gave 2 traits instead of 3 to 5, a farewell instead of a greeting, and ignored the description.

The XGrammar bundled in `@mlc-ai/web-llm` 0.2.85 was tested directly in Node, by converting the schema to its grammar (EBNF) with the bundle's own converter:

- `minItems: 3, maxItems: 5` becomes a repetition of `{2,4}` after the first item.
- `maxLength: n` becomes `[^"\\\r\n]{0,n}`.
- `Grammar.fromJSONSchema` accepts the full soul schema.

## Decision

- `traits` has 3 to 5 items of at most 30 characters. Every string field has a `maxLength`: name 30, title and archetype 60, style and secret 120, catchphrase 80, greeting 200.
- The prompt includes one complete example soul (a white cup with a golden handle). It asks for a different soul, for personality adjectives as traits, and for a greeting (not a farewell) that mentions the object's appearance.
- `max_tokens` goes from 400 to 450; the bounded schema tops out at roughly 300 tokens.
- Normalization and clamping in code stay as a second line of defence.

## Consequences

- Generation always terminates within the schema, so replies no longer fail for running out of tokens.
- Bounded strings cannot contain escapes (XGrammar excludes `"` and `\`), which is fine for these fields.
- The example costs about 120 prompt tokens per soul.

## Amendment: tighter bounds, a different example, cleanup in code

The first English run on the iPhone (Llama 3.2 1B) showed four problems:

- **Token budget too small.** English JSON measured about 2 characters per token (946 characters in 449 tokens), so a reply that filled every field hit the 450-token cap after 20.7 s. A shorter reply finished in 3.7 s.
- **Copied example.** The model copied the teacup example into a radiator: "crack", "shiny handle", "Nice and toasty!".
- **Stage directions.** It added them anyway: "(Suddenly turns off and on like a doohickey)", "(Sparky nods,".
- **Cut-off greeting.** The greeting was cut mid-sentence and ignored the given appearance.

Changes:

- **Tighter bounds.** Title and archetype 40 characters, traits 20, style and secret 80, catchphrase 60, greeting 140. At most about 570 characters of values, and `max_tokens` is 512.
- **Different example.** It is now an old blue umbrella ("Captain Drizzle"), deliberately far from warmth and kitchens. The prompt forbids reusing its names, phrases or details, asks for one-word traits and a one- or two-sentence greeting, and repeats the appearance the greeting must mention.
- **Cleanup in code.** Every field loses text in brackets or asterisks, including cut-off ones (`stripStageDirections`), and the greeting is trimmed back to its last complete sentence (`endAtSentence`).
