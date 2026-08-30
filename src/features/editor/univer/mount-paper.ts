import type { IDocumentData } from '@univerjs/core';
import { DocumentFlavor, getDocsEmptySnapshot, LocaleType, mergeLocales } from '@univerjs/core';
import { UniverDocsCorePreset } from '@univerjs/preset-docs-core';
import docsLocale from '@univerjs/preset-docs-core/locales/en-US';
import { createUniver } from '@univerjs/presets';
import type { MountedUniverEditor, MountUniverEditorOptions } from './types';
import '@univerjs/preset-docs-core/lib/index.css';

export function mountPaper({ host, id, name, snapshot, canEdit = true, onSnapshot }: MountUniverEditorOptions): MountedUniverEditor {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: { [LocaleType.EN_US]: mergeLocales(docsLocale) },
    presets: [UniverDocsCorePreset({ container: host })],
  });

  const document = univerAPI.createDocument(
    (snapshot ?? getDocsEmptySnapshot(id, LocaleType.EN_US, name, DocumentFlavor.TRADITIONAL)) as IDocumentData,
  );
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const commandSubscription = canEdit ? univerAPI.addEvent(univerAPI.Event.CommandExecuted, () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => onSnapshot(document.save()), 350);
  }) : undefined;

  return {
    dispose() {
      clearTimeout(saveTimer);
      if (canEdit) onSnapshot(document.save());
      commandSubscription?.dispose();
      // Univer owns a nested React root. Dispose it after Flockdoc's outer
      // React commit finishes to avoid nested synchronous unmounts.
      setTimeout(() => univer.dispose(), 0);
    },
  };
}
