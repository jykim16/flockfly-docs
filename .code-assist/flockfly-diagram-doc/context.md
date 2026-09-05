# Flockfly Diagram Context

## Requirements

- Add `diagram` as a third flockdoc type in local and cloud workspaces.
- Use the Excalidraw editor and scene snapshot format established by the sibling `excalidraw-mcp` repository.
- Preserve the Paper/Spreadsheet collaboration surface: authentication, roles, invitations, sharing, presence, realtime revision delivery, offline queueing, checkpoints, conflict protection, folder moves, deletion, and browser persistence.
- Keep existing Paper and Spreadsheet behavior passing unchanged.

## Existing Documentation

- `README.md` defines Paper and Spreadsheet as current flockdoc types and requires `npm test` plus `npm run build`.
- No project `CODEASSIST.md` exists. Project-specific workflow constraints therefore come from package scripts and surrounding code conventions.
- The sibling `excalidraw-mcp/README.md` and `src/mcp-app.tsx` establish `@excalidraw/excalidraw` 0.18 and `{ elements, appState, files }` scene data.

## Integration Map

- Workspace UI and routing: `src/types.ts`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/features/workspace/FlockdocTable.tsx`.
- Local persistence and WebMCP schemas: `src/lib/workspace-storage.ts`, `src/lib/webmcp.ts`.
- Editor: new `DiagramEditor` wrapping the Excalidraw component with the existing editor header and permission controls.
- Collaboration: new diagram operation codec, API method, outbox entry, and `RemoteEditor` realtime handling. Scene updates are journaled and paired with checkpoints.
- Cloud contract and validation: sibling `flockfly-backend/context-router` shared contracts, flockdoc routes, collaboration service, and database type constraint.

## Acceptance Criteria

- A user can create, list, filter, open, rename, move, share, invite collaborators to, and delete a Diagram.
- Signed-out diagrams persist Excalidraw-compatible scenes in browser storage.
- Signed-in edits queue offline, replay idempotently, checkpoint, and arrive live for other clients.
- View-only users cannot edit; share controls follow the same permissions as existing types.
- Existing frontend and backend tests plus builds/typechecks remain green.

## Uncertainty

- Excalidraw does not provide the same CRDT merge model as Paper. Diagram operations therefore use complete immutable scene snapshots with ordered revisions; concurrent scenes are resolved by server revision order and protected by the existing conflict/recovery path.
