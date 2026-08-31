# Realtime collaboration context

## Scope

Implement the agreed Flockdoc realtime roadmap across the standalone Univer frontend and the existing Flockfly API. Work proceeds automatically and each milestone is isolated in matching conventional commits in every repository it touches.

## Existing architecture

- `flockfly-docs` mounts Univer Paper and Spreadsheet editors and persists debounced full snapshots through `SerializedSnapshotSaver`.
- `flockfly-backend/context-router/api` authenticates platform sessions, authorizes Flockdoc actions, stores snapshots in S3, and assigns monotonic revisions in Postgres.
- `flockdoc_updates` is already the durable per-document revision log.
- Production API tasks share ElastiCache Redis; local development and tests use in-memory ports.
- A snapshot conflict currently produces HTTP 409 and requires a manual reopen.

## Dependency map

```text
Univer command -> snapshot saver -> HTTP state write -> Postgres/S3
                                         |
                                         v
                                  realtime broker
                                         |
                                         v
browser WebSocket <- scoped ticket <- authenticated Flockdoc API
```

Milestone 2 will make the update log the recovery path. Later milestones replace snapshot notification payloads with structured operations while retaining this transport, authorization, revision cursor, and snapshot fallback.

## Milestone 2 recovery design

```text
socket opens/reopens
        |
        v
GET updates?afterRevision=<local>&limit=<bounded>
        |
        +-- ordered retained events -> replay in revision order
        |
        `-- retention gap -> load authoritative snapshot checkpoint
```

Each persisted update records the originating client ID so the durable event envelope has the same echo-suppression semantics as live delivery. Snapshot rows become `revision.committed` events; opaque legacy update rows become `update.committed` events and remain replayable for the operation milestone.

## Constraints and decisions

- HTTP remains the authoritative write path; WebSockets deliver committed events and presence.
- Redis Pub/Sub is transport only. Postgres and S3 remain authoritative.
- Direct WebSocket connections use short-lived, single-use document-scoped tickets because the platform session cookie is HttpOnly and scoped through the platform origin.
- Presence is ephemeral and must never consume document revisions.
- Clients never overwrite unsaved local state after receiving a remote revision.
- Catch-up cursors are document revisions, not transport message IDs.
- The API returns `limit + 1` internally to provide stable bounded pagination without a count query.
- If retained history starts after the requested cursor, clients load the current snapshot instead of guessing across a gap.
- There is no repository-level `CODEASSIST.md`; relevant READMEs and the existing realtime recommendation were reviewed.

## Implementation paths

- Backend ports and services: `context-router/api/src/ports`, `services/flockdoc-collaboration.ts`
- Backend HTTP/WebSocket boundary: `routes/flockdoc-collaboration.ts`, `server.ts`
- Frontend transport/API: `src/lib/api.ts`, `src/lib/flockdoc-realtime.ts`
- Frontend editor integration: `src/features/editor/RemoteEditor.tsx`
- Tests: each repository's existing Vitest suites
