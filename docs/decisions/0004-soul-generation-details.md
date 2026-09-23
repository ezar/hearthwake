# 0004. Soul JSON generation details

Status: accepted, M0.

## Context

Soul creation uses WebLLM `response_format` with a JSON schema. Small models still produce edge cases: out-of-range voice values, too many traits, empty strings.

## Decision

- The schema only states field types and required fields. Array bounds (3 to 5 traits) and number ranges are asked for in the prompt and enforced in code, because grammar support for `minItems`, `maxItems`, `minimum` and `maximum` varies between WebLLM versions and a rejected schema would break waking entirely.
- Parsing: `JSON.parse`, then the first balanced `{...}` block (string-aware, so braces inside values do not confuse it), then a clear error.
- Normalization trims strings, keeps at most 5 non-empty traits, clamps `pitch` to 0.6..1.6 and `rate` to 0.8..1.2 (numeric strings accepted, anything else falls back to 1), and fails if `name` or `greeting` is missing.

## Other small choices

- Detection pauses while a thing is waking, so `wake.*` timings measure the models and not GPU contention with the detector. It resumes afterwards.
- The WebLLM engine is created once and reused with `reload`, also after Free.
- Loading a transformers.js model that is already loaded disposes the old one first.
- The sentence splitter also keeps closing quotes and brackets after the terminal punctuation with their sentence (`«¡basta!»`).
