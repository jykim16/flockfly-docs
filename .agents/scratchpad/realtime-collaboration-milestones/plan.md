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

## Risks

- Multiple API tasks require Redis Pub/Sub; an in-memory broker is only for local/test use.
- WebSocket health must be independent of durable persistence; missed messages are repaired by Milestone 2.
- Whole-snapshot writes still conflict during Milestone 1. Only clean clients auto-refresh.
- Structural spreadsheet and Paper concurrency remain deliberately out of scope until their dedicated milestones.

