# Plan

## Test scenarios

1. Anonymous workspace: input a local spreadsheet snapshot; output is the same persisted snapshot after reload.
2. First authentication: input one anonymous Paper and one Spreadsheet; output is two cloud documents with their snapshots and an empty anonymous workspace.
3. Interrupted migration: input a stored local-to-cloud mapping; output resumes the existing cloud document without creating a duplicate.
4. Offline outbox: input failed paper/spreadsheet/checkpoint writes; output remains durable and ordered.
5. Reconnect: input queued writes and a restored API; output flushes once with stable idempotency keys and clears storage.
6. Account isolation: input queued writes for account A; output exposes none to account B.
7. Structural replay: input a stale structure patch; output uses the server's current revision when sent.
8. App integration: authenticated startup migrates rather than replaces anonymous documents.

## Implementation

- Add a resumable anonymous migration helper.
- Add a storage-backed authenticated outbox with single-flight flushing and checkpoint coalescing.
- Wire migration into authentication before loading the final cloud workspace.
- Wire remote editor writes and reconnect signals into the outbox.
- Preserve local-only behavior when authentication is unavailable.
- Verify targeted tests, full tests, typecheck, build, and browser behavior.

