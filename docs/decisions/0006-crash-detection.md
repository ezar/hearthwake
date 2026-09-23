# 0006. Detect sessions killed for lack of memory

Status: accepted, M0.

## Context

When WebKit on iOS runs out of memory it kills the tab: Safari reloads the page, Edge shows "No se puede abrir esta página". The log and timings lived only in memory, so the session's data was lost exactly when it mattered most.

## Decision

- Every busy step (probe, each model load and free, opening the camera, waking, transcribing and replying) writes an activity marker to `localStorage` (`hearthwake.poc.activity`) before it starts and removes it when it ends, whether it succeeds or fails.
- The log (last 200 lines) and timings (last 500 samples per metric) are mirrored to `localStorage` (`hearthwake.poc.report`): on every visible log line, and at most every 2 s for silent per-frame timings.
- On startup, a leftover marker means the last session died mid-step. The previous log and timings are restored, the page shows which step it was (and marks the model if it was a load), and the copied report includes it as `previousCrash`. With no marker, the saved mirror is discarded and the session starts fresh.

## Consequences

- A crash can be reported after the fact, with the timings that led to it.
- Closing the tab by hand in the middle of a step is also reported as a crash; the notice says "probably".
- Crashes during the detection loop, which runs outside the busy flag, are not marked.
