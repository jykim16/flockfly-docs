import type { IWorkbookData } from '@univerjs/core';
import { getSheetsEmptySnapshot, LocaleType, mergeLocales } from '@univerjs/core';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsLocale from '@univerjs/preset-sheets-core/locales/en-US';
import { createUniver } from '@univerjs/presets';
import { registerUniverWebMCP } from '../../../lib/univer-webmcp';
import { patchesFromChangedRanges } from '../../../lib/spreadsheet-operations';
import type { MountedUniverEditor, MountUniverEditorOptions } from './types';
import '@univerjs/preset-sheets-core/lib/index.css';

export function mountSpreadsheet({ host, id, name, snapshot, canEdit = true, onSnapshot, onDirty, onSpreadsheetOperation }: MountUniverEditorOptions): MountedUniverEditor {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: { [LocaleType.EN_US]: mergeLocales(sheetsLocale) },
    presets: [UniverSheetsCorePreset({ container: host })],
  });

  let workbook = univerAPI.createWorkbook(
    (snapshot ?? getSheetsEmptySnapshot(id, LocaleType.EN_US, name)) as IWorkbookData,
  );
  const unregisterWebMCP = registerUniverWebMCP({ ownerDocument: host.ownerDocument, univerAPI, canEdit });
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let applyingRemoteOperation = false;
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

  return {
    applySpreadsheetOperation(operation) {
      const sheet = workbook.getSheetBySheetId(operation.sheetId);
      if (!sheet) return;
      applyingRemoteOperation = true;
      try {
        for (const change of operation.changes) {
          const range = sheet.getRange(change.row, change.column);
          if ('formula' in change) range.setFormula(change.formula);
          else if ('value' in change) range.setValue(change.value);
          else range.clearContent();
        }
      } finally {
        applyingRemoteOperation = false;
      }
    },
    applySnapshot(nextSnapshot) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      commandSubscription?.dispose();
      valueSubscription?.dispose();
      univerAPI.disposeUnit(workbook.getId());
      workbook = univerAPI.createWorkbook(
        (nextSnapshot ?? getSheetsEmptySnapshot(id, LocaleType.EN_US, name)) as IWorkbookData,
      );
      commandSubscription = subscribeToChanges();
      valueSubscription = subscribeToValueChanges();
    },
    dispose() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        onSnapshot(workbook.save());
      }
      commandSubscription?.dispose();
      unregisterWebMCP();
      // Univer owns a nested React root. Dispose it after Flockdoc's outer
      // React commit finishes to avoid nested synchronous unmounts.
      setTimeout(() => univer.dispose(), 0);
    },
  };
}
