# Context

## Requirement

Stop Paper documents from submitting an endless sequence of identical `paper.yjs.update` operations while revisions continue to advance.

## Relevant flow

- `mount-paper.ts` reports the current Univer snapshot after editor commands.
- `RemoteEditor.tsx` converts each reported snapshot into a Yjs operation and queues it durably.
- `paper-collaboration.ts` diffs body text and stores the full Univer snapshot as Yjs metadata.
- `flockdoc-outbox.ts` submits each queued Paper operation exactly once per queue entry.

## Finding

`PaperCollaborationDocument.updateFromSnapshot` writes the metadata map on every call, even when the serialized snapshot is identical to the value already stored. Yjs records that assignment as a new update, so harmless editor commands or snapshot reapplication can continually create network writes.

## Implementation path

Make metadata assignment conditional on an actual serialized-value change. Preserve text diffing and formatting metadata updates. Add a regression test at the collaboration boundary, where duplicate snapshots must produce no operation.

