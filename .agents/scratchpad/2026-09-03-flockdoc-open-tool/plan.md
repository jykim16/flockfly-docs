# Plan

## Test strategy

- Registration: expected tool order includes `flockdoc.open` after `flockdoc.list`.
- Schema: `flockdoc.open` requires exactly an `id` string.
- Delegation: executing the tool forwards the input and returns the action result.
- App integration: opening a listed spreadsheet navigates to `/flockdoc/spreadsheet/{id}`.
- Error path: an unknown ID rejects and leaves the current route unchanged.

## Implementation

- Extend `FlockdocActions` with `openFlockdoc`.
- Register the new tool in `webmcp.ts`.
- Implement the action in `App` using `itemsRef`, `routeFor`, and `navigateFlockdoc`.
- Update the README tool inventory.
- Run targeted tests, full tests, typecheck, and production build.

## Risks

- The registration effect is intentionally stable; the action must read `itemsRef` rather than close over an old item list.
- Navigation must occur only for files visible in the current workspace to avoid guessing type or access.

