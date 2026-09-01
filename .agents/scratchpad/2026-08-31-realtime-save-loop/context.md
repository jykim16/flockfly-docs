# Context

## Requirement

Opening the same Flockdoc in two live sessions must not cause remote refreshes to create new revisions. Only a content change should be persisted.

## Existing flow

- `RemoteSnapshotSynchronizer` loads a newer authoritative state and updates `liveState`.
- `RemoteEditor` keys the Univer child by revision, so a remote state application remounts the editor.
- Univer command listeners debounce `workbook.save()` / `document.save()` and call `onSnapshot`.
- Editor disposal currently flushes a pending debounce.
- `RemoteEditor.onSnapshot` always calls `saveState`, even when the emitted snapshot equals the authoritative snapshot just loaded.

## Dependency map

Realtime event -> `RemoteSnapshotSynchronizer` -> `RemoteEditor` state -> Univer remount -> command callback/cleanup -> `onSnapshot` -> `SerializedSnapshotSaver` -> API revision.

## Implementation path

Add a small snapshot equality gate at the remote persistence boundary, update its baseline after remote application and successful saves, and ensure editor teardown cancels rather than flushes pending autosave work.

