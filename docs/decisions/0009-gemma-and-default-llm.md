# 0009. Offer Gemma 3 1B and default to Llama 3.2 1B

Status: accepted, M0. Supersedes the spec's default (Qwen2.5 1.5B) and the Gemma exclusion.

## Context

Qwen2.5-1.5B does not fit on the iPhone next to anything else. Llama-3.2-1B-Instruct is the only build measured to load there (879 MB declared by WebLLM). Qwen2.5-0.5B is not smaller in practice (945 MB, because of its large vocabulary). Gemma 3 1B (`gemma3-1b-it-q4f16_1-MLC`, 711 MB) is the smallest build with good Spanish, but it was excluded because its chat template rejects the system role.

## Decision

- The default LLM is Llama-3.2-1B-Instruct.
- Gemma 3 1B is added to the picker. For Gemma models, `adaptMessages` puts the system prompt at the top of the first user turn, or turns it into a user turn when none follows. Other models get the messages unchanged.
- Gemma 3 1B has only a q4f16 build, so it appears only when the probe finds `shader-f16`.

## Consequences

- One code path for all models. The Gemma adaptation is covered by unit tests.
- Comparing Llama and Gemma personality in Spanish is part of the remaining M0 protocol.
