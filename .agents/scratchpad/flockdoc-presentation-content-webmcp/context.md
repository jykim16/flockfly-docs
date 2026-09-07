# Context

## Goal

Make Presentation WebMCP useful for authoring slide content without requiring agents to know Univer's internal snapshot schema.

## Existing documentation

- `README.md` documents the current low-level presentation tools and the shared collaboration path.
- No `CODEASSIST.md` exists.

## Integration

Semantic WebMCP inputs are translated into Univer page elements, then passed to the existing `writeSnapshot` callback. That callback already drives local persistence, the durable outbox, realtime revisions, checkpoints, and permission-aware tool registration.

Univer Slides beta.2 renders text elements, URL-backed images, and rectangle, rounded-rectangle, and ellipse shapes. The semantic API is bounded to those supported render types.

