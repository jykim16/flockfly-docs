# Plan

## Test scenarios

- An unchanged Paper snapshot produces `null` rather than a Yjs operation.
- A genuine text edit still produces an operation and synchronizes correctly.
- A metadata/formatting-only change still produces an operation.

## Implementation

- [x] Add the unchanged-snapshot regression test and confirm it fails.
- [x] Guard the Yjs metadata write with an equality check.
- [x] Run focused and full tests.
- [x] Run the production build.
- [x] Review and commit the fix.
