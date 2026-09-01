# Context

## Requirement

A remote revision should appear without blanking or replacing the surrounding Paper/Spreadsheet editor page.

## Finding

`RemoteEditor` keys the editor component by `liveState.revision`. Every applied remote snapshot therefore unmounts the Flockdoc editor shell and its nested Univer application, then dynamically imports and mounts both again. This creates the visible blank flash.

## Relevant supported APIs

- Univer's facade supports disposing and recreating a document/workbook unit inside an already-mounted Univer application.
- Document models also expose reset behavior, but the workbook model does not provide an equivalent complete reactive reset; using the common unit lifecycle keeps Paper and Spreadsheet behavior aligned.

## Dependency map

Remote revision -> `setLiveState` -> revision React key -> editor shell unmount -> Univer root disposal -> new dynamic mount -> visible blank flash.

## Implementation path

Keep the React editor and Univer application mounted. Extend the mounted-editor adapter with `applySnapshot`, replace only the active Univer unit, and rebind autosave listeners after replacement. The snapshot persistence gate continues to suppress no-op initialization emissions.

