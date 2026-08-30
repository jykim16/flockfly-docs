import type { IWorkbookData } from '@univerjs/core';
import { getSheetsEmptySnapshot, LocaleType, mergeLocales } from '@univerjs/core';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsLocale from '@univerjs/preset-sheets-core/locales/en-US';
import { createUniver } from '@univerjs/presets';
import { registerUniverWebMCP } from '../../../lib/univer-webmcp';
import type { MountedUniverEditor, MountUniverEditorOptions } from './types';
import '@univerjs/preset-sheets-core/lib/index.css';

export function mountSpreadsheet({ host, id, name, snapshot, canEdit = true, onSnapshot }: MountUniverEditorOptions): MountedUniverEditor {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: { [LocaleType.EN_US]: mergeLocales(sheetsLocale) },
    presets: [UniverSheetsCorePreset({ container: host })],
  });

  const workbook = univerAPI.createWorkbook(
    (snapshot ?? getSheetsEmptySnapshot(id, LocaleType.EN_US, name)) as IWorkbookData,
  );
  const unregisterWebMCP = registerUniverWebMCP({ ownerDocument: host.ownerDocument, univerAPI, canEdit });
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const commandSubscription = canEdit ? workbook.onCommandExecuted(() => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => onSnapshot(workbook.save()), 350);
  }) : undefined;

  return {
    dispose() {
      clearTimeout(saveTimer);
      if (canEdit) onSnapshot(workbook.save());
      commandSubscription?.dispose();
      unregisterWebMCP();
      // Univer owns a nested React root. Dispose it after Flockdoc's outer
      // React commit finishes to avoid nested synchronous unmounts.
      setTimeout(() => univer.dispose(), 0);
    },
  };
}
