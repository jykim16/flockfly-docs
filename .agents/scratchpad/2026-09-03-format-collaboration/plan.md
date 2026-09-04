# Plan

## Test strategy

- Given a Univer style mutation, the adapter checkpoints the resulting workbook once after command coalescing.
- Given several nested commands from one formatting action, only one checkpoint is produced.
- Given a value-only mutation, the presentation checkpoint path remains idle.
- Given WebMCP formatting after a detected presentation command, the explicit flush persists once and cancels the pending timer.
- Given a contiguous checkpoint from another client, the receiver reloads it; a local contiguous checkpoint only advances revision state.
- Existing value, structure, WebMCP, encoding, and refresh tests remain green.

## Implementation

- Add a focused presentation-command classifier.
- Add a coalesced presentation checkpoint scheduler/flush in the Univer adapter.
- Reuse the flush callback for WebMCP.
- Make checkpoint disposition source-aware and use the realtime event client ID.
- Run targeted tests, full tests, typecheck, and production build.

## Risks

- Univer emits nested commands for one toolbar action; coalescing prevents duplicate checkpoint revisions.
- Applying a remote snapshot must not trigger local persistence; command subscriptions are already suspended during replacement.
- Presentation checkpoints are whole-workbook snapshots, so receivers must distinguish remote checkpoints from acknowledgements of their own save.

