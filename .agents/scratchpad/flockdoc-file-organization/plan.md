# Flockdoc file organization plan

## Test scenarios

1. API mapping retains `parentFolderId`; folder list/create, file move, and delete use the expected endpoints and payloads.
2. Local folder metadata round-trips independently while legacy document storage remains compatible.
3. New → Folder opens a named folder form, creates under the current folder, and renders a navigable folder row.
4. Folder navigation shows a Sessions-style breadcrumb and only direct children.
5. Creating a Paper or Spreadsheet inside a folder assigns that folder as its parent.
6. Move opens an inline destination selector; confirming moves the file to root or another folder.
7. Delete opens an inline confirmation; confirming removes the active file.
8. Move/Delete controls respect `canEdit` and `canDelete` when backend permissions are present.
9. WebMCP registers folder creation, move, and delete tools that use the same application actions.
10. Backend rejects nonexistent, foreign-owner, or cross-organization folder targets during create and move.

## Implementation checklist

- [x] Inventory Sessions and Flockdoc frontend/backend patterns.
- [x] Add frontend and backend failing tests.
- [x] Implement target-folder backend validation.
- [x] Add folder-aware client types, persistence, and API methods.
- [x] Implement folder creation and breadcrumb navigation.
- [x] Implement permission-aware Move and Delete row actions.
- [x] Expose matching WebMCP tools.
- [x] Run full frontend/backend tests, types, builds, and rendered QA.
- [x] Commit repositories without pushing.
- [x] Deploy API before Flockdoc and verify production.

## Decisions

- Match Sessions with inline row confirmation instead of hidden context menus.
- Treat Delete as the backend's existing 30-day soft delete; no permanent-delete UI is added.
- Support moving files only, as requested; folder move/delete remains outside this scope.
- Keep folders visible regardless of the Paper/Spreadsheet filter so navigation is never blocked.
