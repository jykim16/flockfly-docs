# Flockdoc Univer editor plan

## Test scenarios

1. Empty storage loads an empty workspace.
2. Valid versioned storage restores file metadata and Paper/Spreadsheet snapshots.
3. Malformed or incompatible storage fails safely to an empty workspace.
4. Saving a workspace serializes snapshots and updates the durable record.
5. Opening a Paper or Spreadsheet renders the corresponding lazy editor boundary.
6. Snapshot callbacks update the matching persisted flockdoc without altering other files.
7. Univer Sheets WebMCP registers the nine tools from the user's existing implementation and unregisters them on cleanup.
8. Production build emits separate Paper and Spreadsheet editor chunks under `/flockdoc/`.

## Implementation checklist

- [x] Explore the standalone app, backend boundary, and local Univer checkout.
- [x] Confirm exact `1.0.0-beta.2` Univer presets are published.
- [ ] Write storage, routing, and WebMCP tests and confirm RED.
- [ ] Install exact Univer dependencies.
- [ ] Implement versioned workspace persistence.
- [ ] Implement lazy Univer Docs and Sheets mounts with snapshot callbacks.
- [ ] Bring the existing Sheets WebMCP adapter into Flockdoc.
- [ ] Refactor editor layout to host native Univer UI.
- [ ] Run tests, typecheck, production build, and browser verification.
- [ ] Commit the verified implementation.

## Performance and safety

- Editor packages are dynamically imported so the workspace list does not pay the Univer bundle cost.
- Snapshot writes are debounced and versioned.
- Invalid local data is ignored instead of crashing the workspace.
- Univer instances, event listeners, timers, and WebMCP registrations are disposed on editor teardown.
