# Flockdoc implementation plan

## Product vocabulary

- A **flockdoc** is a saved collaborative object.
- A **Paper** is a flockdoc with type `paper`.
- A **Spreadsheet** is a flockdoc with type `spreadsheet`.
- **Flockdoc** is also the Drive-like workspace where Papers, Spreadsheets, and folders are organized.

Legacy labels such as Docs, Sheets, and Drive are not used in product-facing contracts.

## Repository boundary

| Area | Repository | Responsibility |
| --- | --- | --- |
| Web product | `flockfly-docs` | Workspace, Paper UI, Spreadsheet UI, comments/activity surfaces, WebMCP registration |
| Platform services | existing Flockfly backend | Authentication, organizations, unified authorization, metadata, collaboration journal, versions, comments, share links, agent principals |

`contextrouter` is not a frontend package dependency. Flockdoc uses the existing backend service and its permission model, while remaining independently buildable and deployable.

## Unified authorization model

Every grant uses the same tuple:

```text
(entity_type, entity_id, principal_type, principal_id, access_type)
```

Supported principals are `user`, `team`, `agent`, and `link`. Flockdoc role bundles map onto capabilities:

| Role | Capabilities |
| --- | --- |
| Viewer | read |
| Commenter | read, comment |
| Editor | read, comment, edit |
| Manager | read, comment, edit, share |
| Owner | create, read, comment, edit, share, delete |

This is the same authorization substrate used by skills and routers. Agents and share links are principals, not special bypass paths.

## Delivered foundation

- [x] Standalone React + Vite frontend repository.
- [x] Responsive Flockdoc workspace with search, type filters, selected state, collaborator/agent presence, activity, and threaded comment presentation.
- [x] Paper editing surface.
- [x] Spreadsheet calendar editing surface modeled on the supplied 2026 planner.
- [x] Page-defined WebMCP tools for workspace, sharing, comments, Paper updates, and Spreadsheet range updates.
- [x] Backend `flockdoc` and nested folder schemas and CRUD APIs.
- [x] Unified user/team/agent/link grants with legacy email-grant compatibility.
- [x] Durable, idempotent revision journal and named version checkpoints.
- [x] Anchored threaded comments and resolution.
- [x] Revocable, expiring, hashed share links backed by `link` principal grants.
- [x] Trash/restore with delayed purge metadata.
- [x] Automated backend and frontend tests plus browser verification.

## Production milestones

### 1. Authentication and API wiring

- Mount the frontend under `platform.flockfly.ai/flockdoc`.
- Exchange the platform session for the existing bearer-token API contract.
- Replace demo fixtures with API queries and optimistic mutations.
- Add invitation acceptance and team-directory pickers.

### 2. Real-time collaboration

- Use a Yjs document per flockdoc and a WebSocket collaboration gateway.
- Persist ordered updates through the existing idempotent update journal.
- Periodically compact updates into snapshots stored through the backend blob port.
- Broadcast presence as ephemeral awareness state; do not persist cursor positions.
- Restore an old version by creating a new head revision, never by rewriting history.

### 3. Editor adapters

- Mount the production Univer Paper and Spreadsheet editors behind a common `FlockdocEditorAdapter`.
- Translate editor-native changes to Yjs updates and anchored comment positions.
- Import `.xlsx` into a Spreadsheet snapshot and export without routing bytes through the browser when a server-side converter is available.
- Preserve the existing spreadsheet WebMCP range/format/grid operations as the Spreadsheet adapter implementation.

### 4. Agent execution

- Issue short-lived, document-scoped agent credentials.
- Resolve every headless tool call through unified grants before applying it.
- Attribute updates, versions, and comments to the `agent` principal.
- Expose bounded tool manifests derived from the agent’s role and current flockdoc type.
- Add rate limits, idempotency keys, audit events, and revocation.

### 5. Operations and deployment

- Provision Postgres, object storage, and the collaboration gateway in the platform environment.
- Add snapshot compaction, retention, purge, and restore workers.
- Instrument join latency, update latency, compaction failures, rejected permissions, and agent tool calls.
- Run multi-user convergence, reconnect, offline replay, large-workbook, and permission-revocation test suites before general availability.

## Acceptance gates

- Two users and one agent converge on the same Paper and Spreadsheet after reconnect.
- Viewers cannot mutate through UI, HTTP, WebSocket, or WebMCP paths.
- Editors can edit but cannot share; managers can share but cannot delete; only owners can delete.
- Link revocation takes effect on the next request and WebSocket authorization refresh.
- Comments preserve anchors through ordinary edits and clearly report detached anchors.
- Every durable update has a principal, idempotency key, revision, and timestamp.
- A corrupted or partial client cannot overwrite a newer server revision.
