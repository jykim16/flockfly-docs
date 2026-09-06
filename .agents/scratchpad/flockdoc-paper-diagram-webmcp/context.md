# Context

## Request

Expose editor-specific WebMCP tools on Paper and Diagram flockdocs, matching the existing Spreadsheet behavior.

## Existing architecture

- `App.tsx` registers workspace-level `flockdoc.*` tools.
- `mount-spreadsheet.ts` registers Spreadsheet editing tools through `registerUniverWebMCP`.
- Paper and Diagram editors currently register no editor-specific tools.
- Paper writes must use the mounted Univer document and its existing snapshot/collaboration callback.
- Diagram writes must use the live Excalidraw API and its existing scene/collaboration callback.

## Requirements

- Register discoverable read tools for Paper and Diagram.
- Register mutation tools only when the current role can edit.
- Route mutations through the same persistence and realtime callbacks as UI edits.
- Remove editor tools when the editor unmounts.
- Preserve existing workspace and Spreadsheet tools.

## Dependency map

- Paper: `PaperEditor` -> `mountPaper` -> Paper WebMCP adapter -> Univer document -> existing snapshot callback.
- Diagram: `DiagramEditor` -> Diagram WebMCP adapter -> Excalidraw API -> existing scene callback.
- Browser: adapters register against `ownerDocument.modelContext` and own registration with an `AbortController`.

## Existing documentation

- `README.md` documents workspace-level WebMCP tools and the shared collaboration infrastructure.
- No `CODEASSIST.md` is present; project commands come from `package.json`.

