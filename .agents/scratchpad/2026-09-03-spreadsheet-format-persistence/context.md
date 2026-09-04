# Context

## Requirement

Persist WebMCP spreadsheet formatting so presentation changes survive a server reload. This is required to make the Calendar Demo's repaired final-week borders, typography, row heights, and non-August gray fill durable.

## Existing behavior

- `write_range` is persisted through cell patch events.
- merge/unmerge is persisted through structure patch events.
- `format_range` changes only the local Univer model; the collaboration adapter does not encode style commands or checkpoint them.
- A reload restores the server snapshot and discards local-only formatting.

## Implementation path

`format_range` -> optional presentation-change callback -> mounted spreadsheet snapshot -> `RemoteEditor` checkpoint saver -> durable snapshot revision -> collaborating clients reload the authoritative presentation.

## Acceptance criteria

- Successful `format_range` calls request one durable presentation checkpoint after all range mutations.
- The mounted adapter supplies the current workbook snapshot to its existing `onSnapshot` callback.
- Snapshot saves wait for queued cell/structure operations to finish, avoiding stale-revision conflicts when formatting follows data edits.
- Existing operation-based collaboration and remote-merge suppression remain intact.

## Existing documentation

The README defines `npm test`, `npm run typecheck`, and `npm run build` as the project validation commands. No `CODEASSIST.md` is present.

