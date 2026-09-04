# Context

## Requirements

1. Signed-out users can create and edit Paper and Spreadsheet flockdocs.
2. Anonymous flockdocs migrate into a newly created account after authentication.
3. Anonymous flockdocs also migrate into an existing account after login.
4. Authenticated users can continue editing through a connection outage, and queued changes are sent after reconnect.

## Existing documentation

- `README.md` describes a Vite/React Flockdoc frontend with local anonymous storage and a revisioned backend.
- No repository-specific `CODEASSIST.md` is present. A future one could capture project-specific build, release, and debugging conventions.

## Existing paths

- `App.tsx` loads the anonymous workspace but currently replaces it with the cloud list after authentication.
- `workspace-storage.ts` persists anonymous metadata and snapshots in `localStorage`.
- `RemoteEditor.tsx` sends paper, spreadsheet, formatting, and checkpoint changes directly to the API. Failed outbound requests are not retried durably.
- `flockdoc-realtime.ts` reconnects and recovers inbound server events only.
- API writes already accept idempotency keys for operations and checkpoints.

## Integration design

- Keep anonymous documents in the existing browser workspace until each migration succeeds.
- Persist resumable anonymous-to-cloud mappings so reconnect cannot create duplicate cloud documents.
- Store authenticated content writes in an account-scoped durable outbox before attempting the network.
- Replay outbox entries in document order with their original idempotency keys; resolve current revisions immediately before revision-sensitive writes.
- Trigger replay immediately, on browser `online`, and after realtime reconnect.
- Never put signed-out edits in a server outbox.

## Dependency map

`App` owns authentication, anonymous migration, and the account-scoped outbox. `RemoteEditor` enqueues content writes through that outbox. The outbox calls `FlockdocApi`; realtime recovery remains responsible for inbound events.

## Risk notes

- Browser storage is finite. Checkpoint entries are coalesced per document while operation entries remain ordered.
- Authentication and permission failures are not connectivity failures and must remain queued without cross-account replay.
- Spreadsheet structural changes are assigned a fresh base revision at send time.

