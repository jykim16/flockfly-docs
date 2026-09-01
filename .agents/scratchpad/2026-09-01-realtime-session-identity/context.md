# Context

## Requirement

Two simultaneously open sessions must receive and apply each other's committed Flockdoc revisions without manual refresh.

## Finding

`getFlockdocRealtimeClientId` persists the echo-suppression identity in `sessionStorage`. A newly opened or duplicated browser tab may begin with a copy of its opener's session storage, so two independent live connections can present the same `clientId`. `RemoteSnapshotSynchronizer` correctly ignores events bearing the local ID, but in this case that also discards the other tab's commits.

## Dependency map

Browser page identity -> realtime ticket and snapshot save `clientId` -> committed event -> local-echo filter -> remote snapshot application.

## Implementation path

Use a page-realm-scoped ID that remains stable for reconnects and document navigation but is never inherited through copied web storage. No backend protocol change is required.

