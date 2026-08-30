# Flockdoc Univer editor context

## Summary

The deployed Paper and Spreadsheet editors are visual placeholders. The sibling `univer` checkout is clean at version `1.0.0-beta.2` and contains the user's committed Sheets WebMCP implementation. Flockdoc must embed the published packages matching that checkout while remaining a standalone repository.

## Requirements

- Replace the hand-built spreadsheet grid with Univer Sheets.
- Replace the plain content-editable Paper with Univer Docs.
- Preserve the existing Flockdoc navigation and editor header.
- Persist file metadata and Univer snapshots across refreshes on the direct CloudFront origin.
- Register the full Univer Sheets WebMCP tool set while a spreadsheet is open.
- Keep workspace-level Flockdoc tools and make editor code load only when opened.
- Retain the backend API boundary for later shared persistence; the current backend has metadata/update writes but no readable snapshot endpoint and the direct CloudFront origin has no platform auth session.

## Existing patterns

- React 19, Vite, TypeScript, Vitest.
- `App.tsx` owns workspace state and routes using the URL hash.
- The local Univer examples mount presets into a provided DOM container and dispose the Univer instance on teardown.
- Both Univer workbook and document facades expose `save()` snapshots.
- Univer exposes `CommandExecuted`, enabling debounced snapshot persistence.

## Dependency map

```text
App workspace state
  -> versioned local workspace repository
  -> lazy PaperEditor / SpreadsheetEditor
       -> Univer 1.0.0-beta.2 core preset
       -> snapshot save callback
       -> workspace repository

Open Spreadsheet
  -> Univer Sheets facade
  -> copied Sheets WebMCP adapter from the user's Univer checkout
```

## Implementation paths

- `src/lib/workspace-storage.ts`: versioned browser persistence.
- `src/features/editor/univer/`: Univer mounting, locale, snapshots, and lifecycle.
- `src/features/editor/*Editor.tsx`: shell header plus lazy Univer host.
- `src/lib/univer-webmcp.ts`: Sheets tools carried from the user's Univer checkout.
- `src/App.tsx`: snapshot callbacks and persisted metadata.

## Constraint

Browser persistence is an immediate durability layer for the CloudFront preview, not the final collaboration store. Shared multi-user persistence still requires a readable backend snapshot/update protocol and authenticated same-origin routing.
