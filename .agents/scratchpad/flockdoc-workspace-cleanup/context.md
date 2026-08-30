# Flockdoc workspace cleanup context

## Goal

Remove nonfunctional workspace controls and the document-level comment surface while preserving Paper and Spreadsheet editing and future editor-scoped collaboration.

## Existing documentation

- `README.md` defines Flockdoc as the Paper and Spreadsheet workspace and lists its WebMCP tools.
- No repository-specific `CODEASSIST.md` exists; adding one later could capture project-specific test and deployment conventions.

## Requirements

- Remove Home, Shared with me, Starred, and Trash from the workspace sidebar.
- Remove the unavailable storage summary and management control.
- Remove starred document state and the star beside each file name.
- Remove workspace Share and link-copy controls.
- Remove the workspace document details/comments drawer and its selection state.
- Stop exposing unanchored `flockdoc.comment` operations; future comments belong to content inside an open document.
- Keep editor-level sharing and permission foundations unchanged.
- Audit and report remaining UI that still needs product or behavior review.

## Implementation paths

- Workspace composition: `src/App.tsx`
- Sidebar: `src/components/Sidebar.tsx`
- File table: `src/features/workspace/FlockdocTable.tsx`
- Obsolete comment drawer: `src/features/workspace/DetailsDrawer.tsx`
- Workspace WebMCP/API surface: `src/lib/webmcp.ts`, `src/lib/api.ts`
- Domain types and documentation: `src/types.ts`, `README.md`
- Behavior tests: `src/__tests__/workspace.test.tsx`, `src/__tests__/webmcp.test.ts`

## Dependency map

Workspace row selection → details drawer → unanchored comment composer.

Flockdoc WebMCP registration → optional document comment action → API comment helper.

Removing each chain at its root avoids retaining dead state, imports, and types.
