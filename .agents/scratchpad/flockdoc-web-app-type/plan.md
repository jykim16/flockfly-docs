# Plan

## Acceptance tests

- Creating a Flockdoc accepts `webapp` and rejects retired `presentation`.
- The Web App bundle operation round-trips and rejects invalid paths, missing entry points, unsupported extensions, and oversized content.
- The workspace shows Web App creation, filtering, routing, icons, and local persistence with no Presentation option.
- The editor renders bundle-linked CSS and JS in a sandboxed preview without mutating saved source.
- Annotation mode emits a stable element anchor; interaction mode leaves application controls usable.
- A commenter can create an element-anchored comment through the existing comment API.
- WebMCP can inspect, list, read, bulk-write, and delete files, and read element comments; viewers do not receive file mutation tools.
- Web App operations use the same outbox, realtime application, checkpoints, and recovery behavior as Diagram and the retired Presentation type.
- Existing Paper, Spreadsheet, Diagram, sharing, permissions, and workspace tests remain green.

## Implementation checklist

- [complete] Write frontend and backend RED tests.
- [complete] Replace shared/backend Presentation contracts, validation, routing, and schema constraint.
- [complete] Add frontend bundle operations, preview compiler, editor UI, comments API, and WebMCP.
- [complete] Replace Presentation routing, labels, icons, storage, outbox, and realtime behavior.
- [complete] Remove Presentation-only modules, dependencies, tests, and documentation.
- [complete] Run focused and full tests, typechecks, builds, infrastructure tests, and browser QA.
- [in_progress] Review and commit each repository without deploying.
