# Flockdoc

Flockdoc is the collaborative document workspace for Flockfly. A saved object is a **flockdoc** and has one of two types:

- **Paper** — a rich-text document.
- **Spreadsheet** — a workbook.

The frontend is intentionally a separate repository. Authentication, storage, permissions, comments, revision history, sharing, and agent identity live in the existing Flockfly backend.

## Run locally

```bash
npm install
npm run dev
```

The app opens at `http://localhost:3003/`. It uses a seeded demo workspace when no backend session is configured.

## Checks

```bash
npm test
npm run build
```

## WebMCP

When the host browser exposes `document.modelContext`, the app registers:

- `flockdoc.list`
- `flockdoc.create`
- `flockdoc.rename`
- `flockdoc.share`
- `flockdoc.comment`
- `paper.update`
- `spreadsheet.update`

The tool boundary is implemented in `src/lib/webmcp.ts`. The same application actions are intended to back human UI operations and agent tool calls so permissions and audit behavior do not diverge.

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for architecture, delivered scope, and the remaining production milestones.
