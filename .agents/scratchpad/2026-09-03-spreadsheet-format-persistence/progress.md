# Progress

- [x] Reproduce formatting loss after a fresh server reload.
- [x] Trace the gap to local-only WebMCP formatting commands.
- [x] Add failing persistence regression tests.
- [x] Implement durable presentation checkpoints.
- [x] Validate tests, typecheck, and build.
- [ ] Validate rendered persistence after deployment.
- [x] React lifecycle and rerender review completed; no additional component refactor needed.
- [ ] Commit the fix.

## TDD cycles

- RED: both persistence tests failed because `format_range` stopped after local activation and the mounted adapter exposed no snapshot callback.
- GREEN: `format_range` now requests one checkpoint after all local presentation mutations, and the mounted adapter snapshots the current workbook.
- REFACTOR: snapshot persistence waits behind queued operation patches to avoid stale base revisions.

## Validation

- Targeted suites: 22 tests passed.
- Full suite: 13 files and 72 tests passed.
- Typecheck: passed.
- Production build: passed with the existing large-chunk warning.
