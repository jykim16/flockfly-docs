# Context

## Requirement

Stop a remotely applied spreadsheet merge from being re-submitted as a new local structure patch. A single remote `range.merge` must not create an update loop as `baseRevision` advances.

## Repository and implementation path

- Frontend repository: `flockfly-docs`
- Univer adapter: `src/features/editor/univer/mount-spreadsheet.ts`
- Operation conversion: `src/lib/spreadsheet-operations.ts`
- Remote delivery: `RemoteEditor` queues operations from other clients; `SpreadsheetEditor` applies them through the mounted adapter.

## Existing pattern and cause

The adapter uses an `applyingRemoteOperation` guard around facade calls. Most facade calls emit synchronously, but Univer's merge facade starts `AddWorksheetMergeCommand` asynchronously and returns before `onCommandExecuted` fires. The guard is therefore false when the merge command is observed, and the remote merge is submitted again as a local operation.

## Acceptance criteria

- A delayed merge command emitted by a remotely applied merge is suppressed.
- A genuine local merge after remote application is still submitted.
- Existing spreadsheet operation behavior, tests, typecheck, and build continue to pass.

## Dependency map

`RemoteEditor remote event` -> `SpreadsheetEditor remoteOperations` -> `mountSpreadsheet.applySpreadsheetOperation` -> `Univer facade` -> `onCommandExecuted` -> `onSpreadsheetOperation`.

