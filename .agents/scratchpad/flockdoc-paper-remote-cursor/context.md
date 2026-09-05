# Context

## Requirement

Every active Paper session keeps its own caret or text selection when another session edits the same document. The behavior must scale independently to any number of connected sessions.

## Existing behavior

- Paper text operations arrive as Yjs updates and are converted to incremental text patches.
- Incremental patches are applied to the mounted Univer document without remounting it.
- Each edit is followed by a full checkpoint. A remote `revision.committed` event currently reloads that checkpoint and recreates the Univer document, resetting the receiving session's selection.
- Formatting-only operations can also require a full snapshot refresh.

## Dependency map

- `RemoteEditor` receives ordered realtime events and decides between incremental application and checkpoint recovery.
- `PaperEditor` forwards remote patches or snapshots to the mounted adapter.
- `mountPaper` owns the Univer document and its session-local selection state.
- Univer's `DocSelectionManagerService` exposes the current document ranges and can restore them after a full snapshot replacement.

## Implementation path

- Treat a contiguous Paper checkpoint from the same author immediately following an applied Paper operation as acknowledgement/compaction, not new editor content.
- Preserve and restore the receiving session's selection whenever an authoritative full snapshot is genuinely required.
- Keep all state local to each mounted editor instance; do not synchronize cursor positions between users.

## Existing documentation

- `README.md`: Vitest and production build are the project checks; the app deploys through the AWS CDK stack.
- No `CODEASSIST.md` is present. A future one could centralize project-specific collaboration and browser-QA conventions.
