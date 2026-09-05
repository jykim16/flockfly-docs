# Plan

## Test scenarios

1. Three receiving sessions process the same remote text operation and its checkpoint; each applies the incremental patch and none replaces its mounted document.
2. A genuine authoritative snapshot replacement captures and restores a collapsed caret at the same offset.
3. A genuine authoritative snapshot replacement preserves a non-collapsed text selection.
4. Restored offsets are clamped when the replacement document is shorter.
5. Existing local-edit, multiline, offline, and realtime recovery tests remain green.

## Implementation checklist

- [x] Add regression tests and confirm the old behavior fails.
- [x] Skip redundant paired Paper checkpoint reloads.
- [x] Preserve selection around unavoidable Paper snapshot replacements.
- [x] Run focused tests, full tests, typecheck, and production build.
- [x] Validate the rendered editor locally and multi-session fan-out in automated tests.
- [x] Commit the verified change without pushing.
