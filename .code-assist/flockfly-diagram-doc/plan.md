# Flockfly Diagram Plan

## Test Strategy

1. Workspace type coverage: creating `Diagram` produces `/flockdoc/diagram/:id`, browser persistence, a Diagram row/filter, and WebMCP accepts `diagram`.
2. Scene codec coverage: valid Excalidraw scenes round-trip through canonical base64; malformed protocol, non-array elements, and oversized scenes are rejected.
3. Editor coverage: Excalidraw receives the stored scene, edit permissions, and emits normalized scene snapshots.
4. Realtime/offline coverage: a diagram edit enters the durable outbox, calls the diagram update endpoint, checkpoints the acknowledged scene, and a remote operation updates the mounted editor without remounting.
5. Backend coverage: Diagram creation succeeds with standard owner permissions; diagram operations are validated, type-restricted, idempotent, journaled, and published.
6. Regression coverage: run the complete frontend test/build suite and the context-router collaboration/workspace tests plus typecheck.

## Implementation Checklist

- [x] Add failing frontend Diagram workspace/editor/collaboration tests.
- [x] Add failing backend Diagram type and operation tests.
- [x] Add frontend Diagram type, UI, editor, codec, API, outbox, and realtime integration.
- [x] Add backend contract, schema, route, validator, and operation append integration.
- [x] Update user-facing documentation and styles.
- [x] Run focused tests, full tests, typechecks, and builds.
- [x] Review diffs and repository status.
- [x] Commit verified changes in each affected repository.
