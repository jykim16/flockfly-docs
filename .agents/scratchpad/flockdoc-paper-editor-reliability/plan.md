# Plan

## Test scenarios

1. Multiline input: `hello\r\n` → `hello\rworld\r\n`; emitted operation converges and produces valid Univer structure.
2. Stable local presentation: local Paper callbacks and acknowledgement rerenders never call `applySnapshot`.
3. Authenticated autosave: a Paper edit appends one operation, clears the queue, then saves a checkpoint at the acknowledged revision.
4. Reload baseline: the saved Paper checkpoint contains the final multiline state, so recovery starts after it and does not duplicate content.
5. Title persistence: a debounced title edit uses the durable queue and clears after server acknowledgement.
6. Failure behavior: an unavailable server retains one durable Paper entry and editing callbacks continue to resolve.

## Implementation checklist

- [x] Add failing tests for multiline structure and authenticated persistence.
- [x] Stabilize Paper presentation state across local saves and acknowledgements.
- [x] Complete paragraph and section metadata for reconstructed text.
- [x] Save a Paper checkpoint with each queued operation.
- [x] Recover from permanently rejected Paper operations when a complete checkpoint follows.
- [x] Run focused tests, full tests, typecheck, and build.
- [ ] Commit and deploy.
- [ ] Verify typing, Enter, title, autosave, reload, and console health in production.
