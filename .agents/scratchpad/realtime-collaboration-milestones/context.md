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

## Constraints and decisions

- HTTP remains the authoritative write path; WebSockets deliver committed events and presence.
- Redis Pub/Sub is transport only. Postgres and S3 remain authoritative.
- Direct WebSocket connections use short-lived, single-use document-scoped tickets because the platform session cookie is HttpOnly and scoped through the platform origin.
- Presence is ephemeral and must never consume document revisions.
- Clients never overwrite unsaved local state after receiving a remote revision.
- There is no repository-level `CODEASSIST.md`; relevant READMEs and the existing realtime recommendation were reviewed.

## Implementation paths

- Backend ports and services: `context-router/api/src/ports`, `services/flockdoc-collaboration.ts`
- Backend HTTP/WebSocket boundary: `routes/flockdoc-collaboration.ts`, `server.ts`
- Frontend transport/API: `src/lib/api.ts`, `src/lib/flockdoc-realtime.ts`
- Frontend editor integration: `src/features/editor/RemoteEditor.tsx`
- Tests: each repository's existing Vitest suites

