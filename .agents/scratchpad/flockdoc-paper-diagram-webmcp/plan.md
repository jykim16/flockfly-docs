# Plan

## Test scenarios

1. Paper editable: register read/inspect/write tools; a replace or append calls the supplied collaborative write callback.
2. Paper view-only: register read tools but omit mutation tools.
3. Diagram editable: register inspect/read/upsert/delete tools; mutations preserve unrelated elements and call the collaborative scene callback.
4. Diagram view-only: register read tools but omit mutation tools.
5. Lifecycle: abort registrations on cleanup.
6. Editor integration: Paper and Diagram mount their adapters and route WebMCP writes through their normal save paths.

## Implementation

- Add small Paper and Diagram WebMCP adapters with consistent result/error handling.
- Wire Paper into the mounted Univer lifecycle.
- Wire Diagram into the live Excalidraw API lifecycle.
- Run focused tests, the full frontend suite, type checking, and the production build.

## Risks

- Programmatic edits could be echoed twice by editor change listeners; guard them while applying WebMCP writes.
- Viewer roles must not receive mutation tools.
- Diagram upserts must normalize the resulting scene before persistence.

