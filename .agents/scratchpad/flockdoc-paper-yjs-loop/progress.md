# Progress

- [x] Set up implementation workspace.
- [x] Trace Paper editor, collaboration, realtime, and outbox paths.
- [x] Identify unconditional Yjs metadata assignment as the loop source.
- [x] RED: reproduce with a failing regression test (unchanged snapshot emitted an update).
- [x] GREEN: suppress no-op metadata writes while preserving formatting-only updates.
- [x] Validate focused tests, full suite (92 tests), and production build.
- [x] Review confirms the change is scoped to no-op suppression and preserves formatting updates.
- [ ] Commit (pending).

## TDD result

- RED: the unchanged `hello world` snapshot produced a redundant `paper.yjs.update`.
- GREEN: unchanged snapshots return `null`; formatting-only and text changes still produce Yjs operations.
- Validation: 16 test files and 92 tests pass; production build succeeds.
