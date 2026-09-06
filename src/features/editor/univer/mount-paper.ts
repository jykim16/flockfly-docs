import type { IDocumentData } from '@univerjs/core';
import { DocumentFlavor, getDocsEmptySnapshot, LocaleType, mergeLocales } from '@univerjs/core';
import { DOC_SELECTION_OPTION_PRESERVE_CARET, DocSelectionManagerService } from '@univerjs/docs';
import { UniverDocsCorePreset } from '@univerjs/preset-docs-core';
import docsLocale from '@univerjs/preset-docs-core/locales/en-US';
import { createUniver } from '@univerjs/presets';
import type { MountedUniverEditor, MountUniverEditorOptions } from './types';
import { registerPaperWebMCP } from '../../../lib/editor-webmcp';
import '@univerjs/preset-docs-core/lib/index.css';

function plainText(snapshot: IDocumentData): string {
  const dataStream = snapshot.body?.dataStream ?? '';
  return dataStream.replace(/\r\n$/, '').replace(/\r/g, '\n');
}

function editorText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r');
}

export function mountPaper({ host, id, name, snapshot, canEdit = true, onSnapshot, onDirty, onPaperSnapshotChange }: MountUniverEditorOptions): MountedUniverEditor {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: { [LocaleType.EN_US]: mergeLocales(docsLocale) },
    presets: [UniverDocsCorePreset({ container: host })],
  });

  let document = univerAPI.createDocument(
    (snapshot ?? getDocsEmptySnapshot(id, LocaleType.EN_US, name, DocumentFlavor.TRADITIONAL)) as IDocumentData,
  );
  const selectionManager = univer.__getInjector().get(DocSelectionManagerService);
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
  const unregisterWebMCP = registerPaperWebMCP({
    ownerDocument: host.ownerDocument,
    id,
    name,
    canEdit,
    getText: () => plainText(document.save()),
    writeText: async text => {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      const snapshot = document.save();
      const dataStream = snapshot.body?.dataStream ?? '';
      const editableEnd = Math.max(0, dataStream.endsWith('\r\n') ? dataStream.length - 2 : dataStream.length);
      applyingRemotePatch = true;
      try {
        const nextText = editorText(text);
        if (editableEnd) document.getTextRange(0, editableEnd).setText(nextText);
        else if (nextText) document.insertText(0, nextText);
      } finally {
        applyingRemotePatch = false;
      }
      onDirty?.();
      const next = document.save();
      if (onPaperSnapshotChange) await onPaperSnapshotChange(next);
      else await onSnapshot(next);
    },
  });

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
      const currentDocumentId = document.getId();
      const selection = selectionManager.getSelectionInfo({ unitId: currentDocumentId, subUnitId: currentDocumentId });
      const textRanges = selection?.textRanges.map(range => ({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        segmentId: range.segmentId,
        segmentPage: range.segmentPage,
        style: range.style,
        rangeType: range.rangeType,
      }));
      clearTimeout(saveTimer);
      saveTimer = undefined;
      commandSubscription?.dispose();
      univerAPI.disposeUnit(document.getId());
      document = univerAPI.createDocument(
        (nextSnapshot ?? getDocsEmptySnapshot(id, LocaleType.EN_US, name, DocumentFlavor.TRADITIONAL)) as IDocumentData,
      );
      commandSubscription = subscribeToChanges();
      if (selection && textRanges?.length) {
        const dataStream = document.save().body?.dataStream ?? '';
        const editableEnd = Math.max(0, dataStream.endsWith('\r\n') ? dataStream.length - 2 : dataStream.length);
        const restoredRanges = textRanges.map(range => ({
          ...range,
          startOffset: Math.min(range.startOffset, editableEnd),
          endOffset: Math.min(range.endOffset, editableEnd),
        }));
        const documentId = document.getId();
        selectionManager.replaceDocRanges(
          restoredRanges,
          { unitId: documentId, subUnitId: documentId },
          selection.isEditing,
          { ...selection.options, [DOC_SELECTION_OPTION_PRESERVE_CARET]: true },
        );
      }
    },
    dispose() {
      if (saveTimer && !onPaperSnapshotChange) {
        clearTimeout(saveTimer);
        onSnapshot(document.save());
      }
      commandSubscription?.dispose();
      unregisterWebMCP();
      // Univer owns a nested React root. Dispose it after Flockdoc's outer
      // React commit finishes to avoid nested synchronous unmounts.
      setTimeout(() => univer.dispose(), 0);
    },
  };
}
