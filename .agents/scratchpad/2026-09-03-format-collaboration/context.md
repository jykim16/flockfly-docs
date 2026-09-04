# Context

## Requirements

- Cell formatting performed from the Univer toolbar must appear in other active sessions without a reload.
- Formatting performed through WebMCP must use the same persistence and realtime path.
- Value and structure collaboration must retain their current granular behavior.
- Remote formatting must not echo back into an update loop.

## Existing architecture

- Spreadsheet values and structure are submitted as realtime operations from `mount-spreadsheet.ts`.
- WebMCP formatting currently saves a workbook checkpoint through `onPresentationChange`.
- A contiguous `revision.committed` event currently advances the receiver revision without loading the checkpoint, so another session does not render the formatting.
- Manual formatting commands are not currently checkpointed while operation collaboration is enabled.

## Implementation path

- Detect Univer presentation mutations/commands in the mounted spreadsheet adapter.
- Coalesce presentation commands into one checkpoint and share the same flush function with WebMCP.
- Treat checkpoints authored by another client as authoritative snapshots that must be loaded even when their revision is contiguous.
- Preserve the remote-operation guard and dispose/recreate command subscriptions during snapshot replacement.

## Existing documentation

- `README.md` describes the Vite frontend, AWS deployment, and the principle that human and WebMCP actions share application behavior.
- No `CODEASSIST.md` exists in the repository.

## Dependency map

Univer toolbar/WebMCP → mounted spreadsheet presentation detector → checkpoint API → realtime `revision.committed` → remote editor checkpoint refresh → mounted workbook snapshot replacement.

