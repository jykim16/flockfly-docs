# Flockdoc prefix model context

## Parameters

- Mode: automatic
- Frontend repository: `flockfly-docs`
- Backend repository: `flockfly-backend/context-router`
- Task: replace explicit folder entities and `parentFolderId` with virtual folders derived from a flockdoc `prefix`

## Existing documentation

- `flockfly-docs/README.md` documents the AWS-hosted Flockdoc frontend and WebMCP boundary.
- `flockfly-backend/context-router/README.md` documents the shared API workspace and deployment model.
- No repository-specific `CODEASSIST.md` exists.

## Existing patterns

- Sessions uses slash-delimited prefixes, derives immediate folder rows, and navigates with a prefix breadcrumb.
- Flockdoc currently persists explicit `flockdoc_folders` rows and stores `parent_folder_id` on each flockdoc.
- The frontend separately loads and stores folder records, then filters files by folder ID.
- Schema statements are idempotent and execute under a PostgreSQL advisory lock during task startup.

## Requirements

- A flockdoc has a normalized slash-delimited `prefix`, with root represented by an empty string.
- Folder rows exist only when at least one visible flockdoc has a matching descendant prefix.
- Creating a Paper or Spreadsheet uses the currently browsed prefix.
- Moving a file accepts a folder path and updates its prefix; entering a new path implicitly creates that virtual folder.
- Explicit folder creation, folder API calls, folder types, and local folder storage are removed.
- Existing folder-based data is migrated to equivalent prefixes without losing files.
- WebMCP uses `prefix` for create/move and no longer exposes `flockdoc.create_folder`.

## Dependency map

Backend schema and shared contract → Flockdoc service mapping → HTTP create/update contracts → frontend API mapper → local workspace migration → derived-prefix navigation/table → UI and WebMCP actions.

## Compatibility decision

Deployment used two stages: first migrate folder ancestry while retaining the legacy schema for draining tasks, then deploy a prefix-only cleanup that drops the folder table, `parent_folder_id`, and obsolete folder access grants. This preserves rolling-release safety while leaving no active folder entity.
