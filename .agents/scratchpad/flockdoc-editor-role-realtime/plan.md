# Plan and test strategy

- [x] RED: backend role mapping gives editor read/comment/edit without share/delete.
- [x] RED: invitations and member role changes accept editor and retain it after acceptance.
- [x] RED: frontend invite and member controls expose “Can edit” between manage and comment.
- [x] GREEN: update shared contracts, schema migration, services, routes, frontend types, and labels.
- [x] REFACTOR: keep role label logic centralized and preserve legacy share-link behavior.
- [x] VERIFY: full frontend/backend tests, typechecks, build, infrastructure tests, commits, deployment, and hosted smoke check.

## Realtime recommendation deliverable

Compare three approaches:

1. Short-term revision notifications and automatic snapshot reload for passive viewers.
2. Custom Flockfly operation stream using WebSockets plus an OT/CRDT merge layer.
3. Univer Pro collaboration server integrated behind Flockfly authorization.

Recommend a staged path with presence first, operation-level collaboration second, and snapshots retained for recovery/version history.

### Option A — revision push with safe auto-reload

- Publish a tiny `revision_committed` event after a snapshot save succeeds.
- Other clients subscribe by flockdoc ID. View-only clients immediately fetch and apply the latest snapshot; editors reload only when they have no unsaved local work.
- Add presence and cursor metadata as ephemeral events with a short TTL.
- Lowest implementation risk and removes refreshes for passive viewers, but concurrent editors still conflict because whole snapshots cannot be merged safely.

### Option B — Flockfly operation stream

- Capture Univer commands as structured, idempotent operations instead of treating every keystroke as a whole snapshot.
- Authenticate a per-document WebSocket with the existing Flockdoc access checks. The server assigns a monotonic revision, persists the operation, and publishes it through the Redis infrastructure already in the API stack.
- Clients apply remote operations through Univer's command/facade layer, suppress local echo, and catch up from an `updates?afterRevision=` endpoint after reconnecting.
- Keep S3 snapshots as periodic compaction checkpoints and version-history artifacts.
- Preserves Flockfly data ownership and supports agents through the same protocol, but requires an OT/CRDT strategy for overlapping text edits and structural spreadsheet operations.

### Option C — Univer collaboration server

- Use Univer's official collaboration client and server, which already provides OT, reconnect states, collaborator presence, and conflict handling for Sheets and Docs.
- Put Flockfly authorization in front of Univer unit creation/loading and map each flockdoc ID to a Univer unit ID.
- Fastest route to mature simultaneous editing, but it is a Univer Pro capability, introduces licensing, and makes Univer Server the collaborative source of truth unless a synchronization layer is maintained.

### Recommended sequence

1. Ship Option A first for immediate no-refresh viewing, presence, and change notifications.
2. Prototype Option B for a bounded spreadsheet operation set: cell values/formulas, formats, row/column operations, and sheet lifecycle.
3. Run the same protocol for agents and humans; permission checks happen on connect and on every write.
4. Add rich-text OT/CRDT for Paper after spreadsheet operations are stable, or choose Option C if time-to-market outweighs licensing and storage-control concerns.
