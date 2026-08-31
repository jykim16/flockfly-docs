# Flockdoc prefix model plan

## Test scenarios

1. Backend create/update accepts `prefix`, canonicalizes root and nested paths, and rejects invalid types or traversal segments.
2. Backend list/get responses expose `prefix` and no longer expose `parentFolderId`.
3. Schema migration converts existing nested folder ancestry into the corresponding slash-delimited flockdoc prefix.
4. Frontend API sends and maps `prefix`, without calling folder endpoints.
5. Local storage defaults legacy root files to `prefix: ""` and migrates legacy folder IDs into paths.
6. Workspace derives immediate virtual folder rows from document prefixes and browses them with a Sessions-style breadcrumb.
7. New Paper/Spreadsheet creation inherits the current prefix; no explicit Folder menu item or dialog remains.
8. Move accepts a folder path, normalizes it, and can create a previously unseen virtual folder.
9. Delete and permission behavior remains unchanged.
10. WebMCP exposes list/create/rename/move/delete with prefix-based create/move schemas and no create-folder tool.

## Checklist

- [x] Initialize task documentation and inspect repository patterns.
- [x] Add backend and frontend RED tests.
- [x] Add schema/contract migration and prefix normalization.
- [x] Replace frontend folder state with derived prefixes.
- [x] Update move UI and WebMCP schemas/actions.
- [x] Remove explicit folder components, routes, and services from active code.
- [x] Run full tests, type-check, build, and rendered QA.
- [x] Commit both repositories without pushing.
- [x] Deploy API first, then Flockdoc, and verify production.
