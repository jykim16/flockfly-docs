import type { IDocumentData } from '@univerjs/core';
import { DocumentFlavor, getDocsEmptySnapshot, LocaleType, mergeLocales } from '@univerjs/core';
import { UniverDocsCorePreset } from '@univerjs/preset-docs-core';
import docsLocale from '@univerjs/preset-docs-core/locales/en-US';
import { createUniver } from '@univerjs/presets';
import type { MountedUniverEditor, MountUniverEditorOptions } from './types';
import '@univerjs/preset-docs-core/lib/index.css';

export function mountPaper({ host, id, name, snapshot, canEdit = true, onSnapshot, onDirty, onPaperSnapshotChange }: MountUniverEditorOptions): MountedUniverEditor {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: { [LocaleType.EN_US]: mergeLocales(docsLocale) },
    presets: [UniverDocsCorePreset({ container: host })],
  });

  let document = univerAPI.createDocument(
    (snapshot ?? getDocsEmptySnapshot(id, LocaleType.EN_US, name, DocumentFlavor.TRADITIONAL)) as IDocumentData,
  );
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let applyingRemotePatch = false;
  const subscribeToChanges = () => canEdit ? univerAPI.addEvent(univerAPI.Event.CommandExecuted, () => {
    if (applyingRemotePatch) return;
    onDirty?.();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      const next = document.save();
      if (onPaperSnapshotChange) void Promise.resolve(onPaperSnapshotChange(next)).catch(() => undefined);
      else onSnapshot(next);
    }, 350);
  }) : undefined;
  let commandSubscription = subscribeToChanges();

  return {
    applyPaperPatch(patch) {
      applyingRemotePatch = true;
      try {
        if (patch.deleteCount) document.getTextRange(patch.index, patch.index + patch.deleteCount).setText(patch.insert);
        else if (patch.insert) document.insertText(patch.index, patch.insert);
      } finally {
        applyingRemotePatch = false;
      }
    },
    getSnapshot() { return document.save(); },
    applySnapshot(nextSnapshot) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      commandSubscription?.dispose();
      univerAPI.disposeUnit(document.getId());
      document = univerAPI.createDocument(
        (nextSnapshot ?? getDocsEmptySnapshot(id, LocaleType.EN_US, name, DocumentFlavor.TRADITIONAL)) as IDocumentData,
      );
      commandSubscription = subscribeToChanges();
    },
    dispose() {
      if (saveTimer && !onPaperSnapshotChange) {
        clearTimeout(saveTimer);
        onSnapshot(document.save());
      }
      commandSubscription?.dispose();
      // Univer owns a nested React root. Dispose it after Flockdoc's outer
      // React commit finishes to avoid nested synchronous unmounts.
      setTimeout(() => univer.dispose(), 0);
    },
  };
}
