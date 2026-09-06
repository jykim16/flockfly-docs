# Context

Add a fourth Flockdoc type, `presentation`, powered by the existing Univer 1.0.0-beta.2 stack. It must retain the same workspace, sharing, permissions, realtime collaboration, checkpoint persistence, offline outbox, and WebMCP behavior as Paper, Spreadsheet, and Diagram.

The frontend lives in `flockfly-docs`; the collaboration API and database schema live in the sibling `flockfly-backend` repository.

## Constraints

- Preserve existing Paper, Spreadsheet, and Diagram behavior.
- Use the open-source `@univerjs/slides` and `@univerjs/slides-ui` packages at the project's pinned Univer version.
- Presentation mutations are edit-only; inspection tools remain available to viewers.
- Reuse the generic snapshot/checkpoint transport where possible.

