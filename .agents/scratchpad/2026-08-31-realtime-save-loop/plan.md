# Plan

## Acceptance criteria and tests

- [x] Given an authoritative snapshot, an identical editor snapshot is ignored and produces no API save.
- [x] Given a changed editor snapshot, it is persisted normally.
- [x] After a successful save or remote apply, that snapshot becomes the new baseline.
- [x] Object property order does not turn equivalent snapshots into changes.
- [x] Editor teardown may flush a real pending edit, but an initialization/no-op snapshot cannot reach the API.
- [x] Existing realtime recovery, frontend tests, typecheck, and production build remain green.

## Implementation

1. Add regression tests for content-aware snapshot persistence.
2. Add a minimal structural equality gate and integrate it into `RemoteEditor`.
3. Preserve teardown flushing for genuine edits; suppress identical loaded snapshots at the API boundary.
4. Run targeted tests, full tests, typecheck, and build.
5. Commit the production fix; deploy only after validation.
