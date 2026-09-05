# Context

## Requirements

- Authenticated Paper typing remains responsive across repeated autosaves.
- Enter creates a new paragraph and subsequent text stays on that line.
- Body edits and title edits reach the server and survive reload.
- Local editor snapshots are not reapplied as remote state.
- Recovery does not duplicate text already represented by the checkpoint.
- Failed saves remain durable and expose a useful status without blocking editing.

## Existing documentation

`README.md` defines Flockdoc as a collaborative Paper/Spreadsheet frontend using the shared backend, realtime updates, and WebMCP actions. Tests and builds run through Vitest and Vite.

## Dependency map

Univer command → `mount-paper.ts` debounced snapshot → `PaperEditor.tsx` adapter → `RemoteEditor.tsx` Yjs conversion → durable outbox → API update journal → realtime/recovery → mounted editor.

## Findings

- Production reproduction shows Enter emits a generic Univer error and does not create a line.
- The editor then reports an offline queue despite an active connection.
- Reload can duplicate prior text, indicating that a legacy snapshot and later Yjs operations are being composed from incompatible baselines.
- `RemoteEditor` recreates `paperCollaboration.snapshot()` on every render, so the mounted editor does not have a stable local presentation snapshot.
- Paper uses Spreadsheet checkpoint-threshold naming and only checkpoints after many operations, leaving legacy snapshots and Paper operations exposed to long recovery chains.

## Direction

Give the mounted Paper a stable locally owned snapshot, ensure paragraph/section metadata is complete for every sentinel, checkpoint Paper edits promptly after their operation is acknowledged, and test the complete authenticated save/reload contract.

