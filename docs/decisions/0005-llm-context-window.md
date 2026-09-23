# 0005. LLM context window of 2048 tokens

Status: accepted, M0.

## Context

On the first iPhone run (iOS 27.2, Edge, so WebKit) the tab was killed near the end of the LLM load. That is when WebLLM allocates GPU memory for the weights and for the KV cache. WebLLM sizes the KV cache for the full context window up front, and the prebuilt configs use 4096 tokens. The probe reported `maxBufferSize` of 1024 MB on that device.

The largest prompt in the spike is the chat turn: the system prompt (about 300 tokens), the last eight history messages (short sentences) and the new user message, plus a reply capped at 160 tokens. Compaction prompts are of similar size. All of it fits in well under 2048 tokens.

## Decision

Load every WebLLM model with `context_window_size: 2048`, both on first creation and on `reload`.

## Consequences

- The KV cache takes roughly half the memory it did at 4096, which matters most for the 1.5B and 3B models.
- The `vram_required_MB` figures in the model picker come from WebLLM's prebuilt list and still assume the default window, so real usage is somewhat lower than shown.
- If M1 needs longer conversations in context, the memory summary is the lever, not a bigger window.
