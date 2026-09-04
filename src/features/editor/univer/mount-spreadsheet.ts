import type { IWorkbookData } from '@univerjs/core';
import { getSheetsEmptySnapshot, LocaleType, mergeLocales } from '@univerjs/core';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsLocale from '@univerjs/preset-sheets-core/locales/en-US';
import { createUniver } from '@univerjs/presets';
import { registerUniverWebMCP } from '../../../lib/univer-webmcp';
import { isSpreadsheetPresentationCommand, patchesFromChangedRanges, structurePatchFromCommand, type SpreadsheetStructureChange, type SpreadsheetStructurePatch } from '../../../lib/spreadsheet-operations';
import type { MountedUniverEditor, MountUniverEditorOptions } from './types';
import '@univerjs/preset-sheets-core/lib/index.css';

export function mountSpreadsheet({ host, id, name, snapshot, canEdit = true, onSnapshot, onDirty, onSpreadsheetOperation, getSpreadsheetRevision }: MountUniverEditorOptions): MountedUniverEditor {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: { [LocaleType.EN_US]: mergeLocales(sheetsLocale) },
    presets: [UniverSheetsCorePreset({ container: host })],
  });

  let workbook = univerAPI.createWorkbook(
    (snapshot ?? getSheetsEmptySnapshot(id, LocaleType.EN_US, name)) as IWorkbookData,
  );
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let presentationSaveTimer: ReturnType<typeof setTimeout> | undefined;
  let applyingRemoteOperation = false;
  let remoteOperationReleaseTimer: ReturnType<typeof setTimeout> | undefined;
  const savePresentation = () => {
    clearTimeout(presentationSaveTimer);
    presentationSaveTimer = undefined;
    return Promise.resolve(onSnapshot(workbook.save()));
  };
  const schedulePresentationSave = () => {
    if (applyingRemoteOperation) return;
    onDirty?.();
    clearTimeout(presentationSaveTimer);
    presentationSaveTimer = setTimeout(() => {
      void savePresentation().catch(() => undefined);
    }, 100);
  };
  const unregisterWebMCP = registerUniverWebMCP({
    ownerDocument: host.ownerDocument,
    univerAPI,
    canEdit,
    onPresentationChange: savePresentation,
  });
  const submitStructureChange = (change: SpreadsheetStructureChange) => {
    if (applyingRemoteOperation || !onSpreadsheetOperation) return;
    const operation: SpreadsheetStructurePatch = {
      protocolVersion: 1,
      kind: 'spreadsheet.structure.patch',
      baseRevision: getSpreadsheetRevision?.() ?? 0,
      changes: [change],
    };
    void Promise.resolve(onSpreadsheetOperation(operation)).catch(() => undefined);
  };
  const subscribeToChanges = () => canEdit && !onSpreadsheetOperation ? workbook.onCommandExecuted(() => {
    onDirty?.();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      onSnapshot(workbook.save());
    }, 350);
  }) : undefined;
  let commandSubscription = subscribeToChanges();
  const subscribeToValueChanges = () => canEdit && onSpreadsheetOperation
    ? univerAPI.addEvent(univerAPI.Event.SheetValueChanged, ({ effectedRanges }) => {
      if (applyingRemoteOperation) return;
      for (const operation of patchesFromChangedRanges(effectedRanges)) {
        void Promise.resolve(onSpreadsheetOperation(operation)).catch(() => undefined);
      }
    })
    : undefined;
  let valueSubscription = subscribeToValueChanges();
  const subscribeToStructureCommands = () => canEdit && onSpreadsheetOperation
    ? workbook.onCommandExecuted(command => {
      if (applyingRemoteOperation) return;
      const operation = structurePatchFromCommand(command, getSpreadsheetRevision?.() ?? 0);
      if (operation) void Promise.resolve(onSpreadsheetOperation(operation)).catch(() => undefined);
    })
    : undefined;
  let structureCommandSubscription = subscribeToStructureCommands();
  const subscribeToPresentationCommands = () => canEdit && onSpreadsheetOperation
    ? workbook.onCommandExecuted(command => {
      if (isSpreadsheetPresentationCommand(command)) schedulePresentationSave();
    })
    : undefined;
  let presentationCommandSubscription = subscribeToPresentationCommands();
  const sheetSubscriptions = canEdit && onSpreadsheetOperation ? [
    univerAPI.addEvent(univerAPI.Event.SheetCreated, ({ worksheet }) => submitStructureChange({ action: 'sheet.create', sheetId: worksheet.getSheetId(), name: worksheet.getSheetName(), index: worksheet.getIndex() })),
    univerAPI.addEvent(univerAPI.Event.SheetDeleted, ({ sheetId }) => submitStructureChange({ action: 'sheet.delete', sheetId })),
    univerAPI.addEvent(univerAPI.Event.SheetNameChanged, ({ worksheet, newName }) => submitStructureChange({ action: 'sheet.rename', sheetId: worksheet.getSheetId(), name: newName })),
    univerAPI.addEvent(univerAPI.Event.SheetMoved, ({ worksheet, newIndex }) => submitStructureChange({ action: 'sheet.move', sheetId: worksheet.getSheetId(), index: newIndex })),
  ] : [];

  return {
    applySpreadsheetOperation(operation) {
      applyingRemoteOperation = true;
      try {
        if (operation.kind === 'spreadsheet.cells.patch') {
          const sheet = workbook.getSheetBySheetId(operation.sheetId);
          if (!sheet) return;
          for (const change of operation.changes) {
            const range = sheet.getRange(change.row, change.column);
            if ('formula' in change) range.setFormula(change.formula);
            else if ('value' in change) range.setValue(change.value);
            else range.clearContent();
          }
        } else {
          for (const change of operation.changes) {
            if (change.action === 'sheet.create') workbook.insertSheet(change.name, { index: change.index, sheet: { id: change.sheetId } });
            else if (change.action === 'sheet.delete') workbook.deleteSheet(change.sheetId);
            else {
              const sheet = workbook.getSheetBySheetId(change.sheetId);
              if (!sheet) continue;
              if (change.action === 'sheet.rename') sheet.setName(change.name);
              else if (change.action === 'sheet.move') workbook.moveSheet(sheet, change.index);
              else if (change.action === 'rows.insert') sheet.insertRows(change.index, change.count);
              else if (change.action === 'rows.delete') sheet.deleteRows(change.index, change.count);
              else if (change.action === 'columns.insert') sheet.insertColumns(change.index, change.count);
              else if (change.action === 'columns.delete') sheet.deleteColumns(change.index, change.count);
              else if ('startRow' in change) {
                const range = sheet.getRange(change.startRow, change.startColumn, change.endRow - change.startRow + 1, change.endColumn - change.startColumn + 1);
                if (change.action === 'range.merge') range.merge({ isForceMerge: true });
                else range.breakApart();
              }
            }
          }
        }
      } finally {
        // Univer reports merge commands in a microtask after its facade returns.
        clearTimeout(remoteOperationReleaseTimer);
        remoteOperationReleaseTimer = setTimeout(() => {
          applyingRemoteOperation = false;
          remoteOperationReleaseTimer = undefined;
        }, 0);
      }
    },
    getSnapshot() { return workbook.save(); },
    applySnapshot(nextSnapshot) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      clearTimeout(presentationSaveTimer);
      presentationSaveTimer = undefined;
      commandSubscription?.dispose();
      structureCommandSubscription?.dispose();
      presentationCommandSubscription?.dispose();
      valueSubscription?.dispose();
      univerAPI.disposeUnit(workbook.getId());
      workbook = univerAPI.createWorkbook(
        (nextSnapshot ?? getSheetsEmptySnapshot(id, LocaleType.EN_US, name)) as IWorkbookData,
      );
      commandSubscription = subscribeToChanges();
      valueSubscription = subscribeToValueChanges();
      structureCommandSubscription = subscribeToStructureCommands();
      presentationCommandSubscription = subscribeToPresentationCommands();
    },
    dispose() {
      clearTimeout(remoteOperationReleaseTimer);
      if (saveTimer || presentationSaveTimer) {
        clearTimeout(saveTimer);
        clearTimeout(presentationSaveTimer);
        void Promise.resolve(onSnapshot(workbook.save())).catch(() => undefined);
      }
      commandSubscription?.dispose();
      structureCommandSubscription?.dispose();
      presentationCommandSubscription?.dispose();
      valueSubscription?.dispose();
      for (const subscription of sheetSubscriptions) subscription.dispose();
      unregisterWebMCP();
      // Univer owns a nested React root. Dispose it after Flockdoc's outer
      // React commit finishes to avoid nested synchronous unmounts.
      setTimeout(() => univer.dispose(), 0);
    },
  };
}
