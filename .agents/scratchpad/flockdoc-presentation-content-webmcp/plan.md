# Plan

- [completed] Add failing tests for semantic slide creation and content authoring tools.
- [completed] Implement normalized element builders and presentation mutations.
- [completed] Register edit-only WebMCP tools with clear schemas and read-me guidance.
- [completed] Run focused tests, full tests, typecheck, and production build.
- [completed] Review and commit.

## Test scenarios

- Create a new slide at a requested position and return its generated ID.
- Add formatted text with requested bounds and safe defaults.
- Add supported shapes and URL-backed images.
- Update an existing element without replacing unrelated properties.
- Delete elements by ID and reject unknown slide IDs or invalid geometry.
- Omit every content mutation tool for view-only collaborators.
