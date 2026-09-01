# Realtime collaboration implementation plan

## Commit policy

Git commits cannot span repositories. Each milestone therefore gets at most one matching atomic commit in each repository it changes. Process notes are included with the corresponding frontend milestone commit.

## Milestones

1. **Realtime foundation** — scoped WebSocket tickets, authenticated document subscriptions, committed revision events, ephemeral presence, reconnecting frontend client, and safe passive refresh.
2. **Durable recovery** — ordered `updates?afterRevision` API, protocol envelopes, bounded pagination, and reconnect replay with snapshot fallback.
3. **Spreadsheet operations** — structured cell value/formula/clear operations, idempotent submission, optimistic acknowledgement, remote apply, and echo suppression behind a capability flag.
4. **Structural collaboration** — ordered sheet/row/column/range operations with conflict rules and checkpoint compaction.
5. **Paper collaboration** — CRDT/OT-backed rich-text changes through the same authorization and event protocol.
6. **Snapshot retirement** — snapshots become periodic checkpoints/version/import/export artifacts rather than the per-edit write format.

## Milestone 1 acceptance tests

- An authenticated reader can request a single-use realtime ticket for a document; an unauthorized user cannot.
- Consuming a ticket validates its document and expires it after one use.
- A successful non-duplicate snapshot commit emits one versioned `revision.committed` event after persistence; duplicate retries do not emit twice.
- A WebSocket subscriber receives only events for its document.
- Join/leave presence events are ephemeral and include the connection identity.
- The frontend requests a ticket, connects to the returned URL, reconnects with backoff, and exposes typed revision/presence events.
- A passive or clean editor fetches and applies a newer snapshot without a refresh.
- An editor with a pending local save does not overwrite its local state when a newer remote revision arrives.
- Existing API, editor, infrastructure, typecheck, and build suites remain green.

## Milestone 1 TDD sequence

1. Add failing backend tests for broker isolation, ticket lifecycle, route authorization, and post-commit event publication.
2. Add failing frontend tests for API ticket requests and realtime connection behavior.
3. Implement the backend broker, ticket service, routes, WebSocket upgrade server, and commit publication.
4. Implement the frontend reconnecting client and safe remote snapshot refresh.
5. Refactor, run focused suites, then full tests/typechecks/builds.

## Milestone 2 acceptance tests

- Readers can list committed events strictly after a non-negative revision cursor.
- Results are ordered by revision, bounded by a validated limit, and expose `hasMore` plus the next revision cursor.
- Snapshot and opaque update rows use versioned protocol envelopes with stable event IDs, originating client IDs, actor metadata, and timestamps.
- A request older than retained history returns `requiresSnapshot: true` and the current head revision.
- Users without document read access cannot inspect update history.
- The frontend API encodes update cursors and pagination limits correctly.
- Opening and reopening a WebSocket invokes recovery with a fresh durable cursor.
- Recovery replays every page in order and uses the authoritative snapshot fallback when the server reports a retention gap.
- Snapshot fallback preserves unsaved local edits using the Milestone 1 safety policy.

## Milestone 2 TDD sequence

1. Add failing backend API tests for ordered pagination, envelope shape, authorization, validation, and simulated retention gaps.
2. Add failing frontend API/client/recovery tests for reconnect catch-up and fallback.
3. Extend the durable schema and persistence writes with client identity.
4. Implement the backend listing service and authenticated GET route.
5. Implement frontend recovery pagination and connect it to every WebSocket open.
6. Refactor, run focused suites, then full tests/typechecks/builds.

## Milestone 3 acceptance tests

- Spreadsheet value, formula, and clear changes are represented as versioned, validated operations.
- Operations are submitted with stable client identity and idempotency keys and receive a committed revision.
- Duplicate idempotency keys cannot be reused for different operation content.
- Realtime and reconnect recovery apply remote operations in durable revision order without reloading the editor.
- A client's committed echo acknowledges its optimistic edit without applying it twice.
- Checkpoint recovery recreates the spreadsheet event subscription and resumes operation capture.
- Existing snapshot behavior remains unchanged while the spreadsheet-operation capability flag is disabled.
- Full backend/frontend tests, typechecks, infrastructure tests, and production builds remain green.

## Milestone 3 TDD sequence

1. Add failing backend contract, validation, authorization, idempotency, persistence, and event tests.
2. Add failing frontend conversion, encoding, API, recovery-cursor, and remote-apply tests.
3. Implement canonical backend spreadsheet cell operations over the durable update journal.
4. Implement feature-flagged Univer cell capture, serialized submission, acknowledgement, and echo-free remote apply.
5. Refactor checkpoint recovery subscriptions, run focused suites, then full verification.

## Milestone 4 acceptance tests

- Sheet create, delete, rename, and move operations use stable sheet IDs.
- Row and column insert/delete operations carry bounded indexes, counts, and the revision they were based on.
- Structural operations are accepted only at their declared base revision; stale operations return the current revision for recovery and retry.
- Committed operations apply in server revision order and remote application does not echo back into the journal.
- Cell operations following structural changes address the post-operation sheet coordinates.
- An operation-count threshold writes an authoritative checkpoint and subsequent recovery starts from that checkpoint revision.
- Recovery across a compacted prefix loads the checkpoint and resumes ordered operation replay.
- Full backend/frontend tests, typechecks, infrastructure tests, and production builds remain green.

## Milestone 4 conflict policy

The backend remains the sequencer. Cell patches use last committed revision order. Structural operations additionally require an exact `baseRevision`, because transforming stale index-based row and column intent is ambiguous. A conflict returns `currentRevision`; the client first recovers the missing operations and then lets the user retry against visible current structure.

## Milestone 4 TDD sequence

1. Add failing backend tests for structural schemas, stale-revision rejection, stable ordering, and checkpoint eligibility.
2. Add failing frontend tests for Univer command conversion, remote apply/echo suppression, conflict recovery, and checkpoint thresholds.
3. Implement structural operation validation and exact-base sequencing in the existing update journal.
4. Implement Univer sheet/row/column capture and remote application through the existing serialized operation queue.
5. Add periodic authoritative checkpoints, reconnect coverage, refactor, and run full verification.

## Risks

- Multiple API tasks require Redis Pub/Sub; an in-memory broker is only for local/test use.
- WebSocket health must be independent of durable persistence; missed messages are repaired by Milestone 2.
- Whole-snapshot writes still conflict during Milestone 1. Only clean clients auto-refresh.
- Milestone 3 is disabled by default because sheet structure and formatting are not operation-backed until Milestone 4.
- Paper concurrency remains deliberately out of scope until its dedicated milestone.
