# Flockdoc file organization context

## Goal

Add persisted folder creation, folder browsing, file moving, and soft deletion to Flockdoc using the interaction and permission patterns established by Sessions.

## Existing documentation

- `README.md` defines the hosted Flockdoc workspace, frontend checks, AWS deployment, and WebMCP tools.
- No repository-specific `CODEASSIST.md` exists; one could later record the two-repository validation and deployment sequence.

## Existing architecture

- Sessions renders folder-like prefix rows, breadcrumbs, and inline Move/Delete confirmation panels.
- Flockdoc backend already provides folder create/list endpoints, `parentFolderId` on flockdocs, `PATCH` for rename/move, and `DELETE` for 30-day soft deletion.
- Flockdoc frontend currently drops `parentFolderId`, does not load folders, and leaves New → Folder as a no-op.
- The backend currently does not validate a target folder when a flockdoc is created or moved.

## Requirements

- Create a folder in the current workspace location and persist it through the backend when signed in.
- Browse folders with a breadcrumb back to the workspace root.
- Create Papers and Spreadsheets inside the current folder.
- Move an editable file to root or an available folder.
- Soft-delete a deletable file after explicit confirmation and remove it from the active list.
- Mirror the capabilities through workspace WebMCP tools for agents.
- Preserve local preview behavior with browser-persisted folders, moves, and deletion.
- Validate target folder ownership and organization in the backend.

## Implementation paths

- Workspace composition and actions: `src/App.tsx`
- Folder/create UI: `src/components/Sidebar.tsx`, new workspace components
- File/folder rows: `src/features/workspace/FlockdocTable.tsx`
- Client and types: `src/lib/api.ts`, `src/lib/workspace-storage.ts`, `src/lib/webmcp.ts`, `src/types.ts`
- Backend validation: `context-router/api/src/services/flockdoc-folders.ts`, `flockdocs.ts`
- Tests: Flockdoc workspace/API/storage/WebMCP suites and backend collaboration foundation suite

## Dependency map

New menu → folder form → local/API create folder → folder state → current-folder listing.

Folder row/breadcrumb → current folder ID → filtered child folders and flockdocs.

File Move/Delete → permission-aware row action → local/API mutation → state refresh.

WebMCP folder/move/delete tool → same application action → same permission-enforcing API.

Backend create/move → target-folder validator → owner/org boundary.
