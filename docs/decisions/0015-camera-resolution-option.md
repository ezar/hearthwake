# 0015. Camera resolution option

Status: accepted, M0.

## Context

The spec asks for the rear camera at an ideal 1280×720; the iPhone delivers 720×1280. The question came up whether the camera's own memory contributes to Safari killing the tab. A 720p frame is about 3.7 MB and the browser holds only a few, so tens of MB at most, against about 900 MB for the LLM. With the two-step wake (ADR 0014) the camera is closed before the LLM loads. It is still cheap to measure rather than assume.

## Decision

A selector next to "Open camera" asks for 720p (default, 1280×720), 480p (640×480) or 360p (640×360). Changing it with the camera open stops the current stream and reopens the camera at the new size. The log records both the requested and the delivered size.

## Consequences

- Detection and vision can be compared across resolutions on the iPhone.
- Lower resolutions give vision fewer pixels for small or distant objects; the crop is already capped at 384 px, so large objects lose little.
