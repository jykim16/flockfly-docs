# Flockdoc editor role and realtime context

## Requirements

- Preserve the Router-shaped member and invitation records used by Flockdoc sharing.
- Add `editor` as a document-only role between manager and commenter.
- Display assignable roles as “Can manage”, “Can edit”, “Can comment”, and “Can view”.
- Managers can edit and invite. Editors can edit and comment but cannot share or administer access.
- Existing owner, commenter, and viewer behavior remains unchanged.
- Explain practical realtime collaboration paths so viewers see changes without refreshing.

## Existing architecture

- The React frontend embeds open-source Univer Docs and Sheets.
- A 350 ms debounce saves a complete Univer snapshot through `POST /v1/flockdocs/:id/state`.
- Saves use a base revision and serialized client queue. Concurrent writers receive a revision conflict and are told to reopen.
- PostgreSQL stores ordered update/revision metadata; S3 stores full snapshots. There is no server-to-client push channel or merge engine.
- Sharing already mirrors Router member/invitation wire shapes and UI structure; document roles are the intended extension point.

## Implementation paths

- Backend role contract and permission mapping: `context-router/shared/src/contracts.ts`, `context-router/api/src/services/flockdocs.ts`, and `flockdoc-members.ts`.
- Invitation schema and route validation: `context-router/api/src/schema.ts` and `routes/flockdocs.ts`.
- Frontend role types and labels: `src/types.ts`, `DocumentShareDialog.tsx`, and the workspace invitation banner.
- Tests: backend Flockdoc route/collaboration suites and frontend sharing/API suites.

## Realtime design constraints

- Merely pushing whole snapshots removes manual refresh for passive viewers but does not make concurrent editing safe.
- True multi-writer collaboration needs operation-level changes plus ordering and conflict resolution (OT or CRDT).
- Univer's official collaboration client/server provides OT-based realtime collaboration, but it is a Univer Pro capability and stores collaborative units in Univer Server.
- A custom solution can retain Flockfly persistence and permissions, but must adapt Univer commands into an operation log and apply remote commands without echo loops.

## Existing documentation

- `README.md` defines Flockdoc as a separate frontend backed by the shared Flockfly API and permissions system.
- No project-specific `CODEASSIST.md` was present.

