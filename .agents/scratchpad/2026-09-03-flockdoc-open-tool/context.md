# Context

## Requirements

- Register a workspace-level `flockdoc.open` WebMCP tool.
- Accept a flockdoc ID returned by `flockdoc.list`.
- Resolve the correct Paper or Spreadsheet route from current workspace metadata.
- Navigate the current page through the same helper used by the human file list.
- Return a useful result and reject unknown IDs without navigating.

## Existing architecture

- `src/lib/webmcp.ts` defines and registers workspace tools against action callbacks supplied by `App`.
- `App` maintains a current `itemsRef` specifically for long-lived WebMCP actions.
- `routeFor` and `navigateFlockdoc` already provide canonical clean-path navigation for both document types.
- `src/__tests__/webmcp.test.ts` verifies tool registration and schemas; workspace tests cover routed editor opening.

## Existing documentation

- `README.md` lists the public WebMCP tool surface and states that human and agent actions share application behavior.
- No repository-specific `CODEASSIST.md` exists.

## Dependency map

`flockdoc.open` tool → `FlockdocActions.openFlockdoc` → current `itemsRef` lookup → `routeFor` → `navigateFlockdoc` → React route state/editor.

