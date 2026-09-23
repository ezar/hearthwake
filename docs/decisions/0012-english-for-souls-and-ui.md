# 0012. Souls and UI in English

Status: accepted, M0. Amends the spec's language rules (UI strings in Spanish, Spanish prompts, Spanish transcription and voices).

## Context

On the iPhone, the only LLM that fits in Safari is a 1B model loaded on its own (docs/models.md). Its Spanish was not good enough for a character with personality:

- Llama 3.2 1B produced a farewell as a greeting, invented details, gave too few traits and made a spelling mistake in the catchphrase.
- Gemma 3 1B looped until it ran out of tokens (fixed separately in ADR 0011).

Small models are markedly stronger in English. Server-hosted models were considered (Vercel, Hugging Face, free tiers, a home PC with Ollama) and set aside for now in favour of keeping everything in the browser.

## Decision

- Keep the LLM in the browser: Llama 3.2 1B through WebLLM remains the default.
- Souls work in English:
  - soul creation prompt and worked example;
  - system prompt and safety rules;
  - memory compaction;
  - Whisper transcribes with `language: 'english'`;
  - speech uses English system voices (`en-*`, falling back to `en-US`).
- The UI is in English: `index.html`, status lines, confirmations, errors shown to the tester, and `lang="en"`.
- Development conversation with the author stays in Spanish; code, comments, commits and docs were already in English.

## Consequences

- Souls saved before this change keep their Spanish texts; new souls are English.
- The M0 questions about Spanish are now about English: personality quality, and whether the system English voices are varied enough.
- Supporting Spanish again later means either a stronger on-device model or a server-hosted one; the prompts are isolated in `poc/src/llm.ts`, so a language switch is contained.
