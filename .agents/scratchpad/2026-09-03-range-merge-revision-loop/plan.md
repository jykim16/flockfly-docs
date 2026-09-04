# Plan

## Test scenarios

1. Apply a remote merge whose Univer command event arrives in a microtask; expected output is zero outbound spreadsheet operations.
2. After the remote guard is released, emit the same command as a local action; expected output is one outbound structure patch with the current revision.

## Implementation

- Extend remote-operation suppression through Univer's deferred command completion window.
- Ensure consecutive remote applications cannot let an earlier release disable suppression for a later operation.
- Dispose any pending release timer with the editor.
- Run focused tests, the full test suite, typecheck, and production build.

