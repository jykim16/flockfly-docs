import type { ICommandService as ICommandServiceType, IUniverInstanceService as IUniverInstanceServiceType } from '@univerjs/core';
import { ICommandService, IUniverInstanceService, LocaleType, mergeLocales, Univer, UniverInstanceType } from '@univerjs/core';
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import docsUiLocale from '@univerjs/docs-ui/locale/en-US';
import { UniverDrawingPlugin } from '@univerjs/drawing';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { SlideDataModel, UniverSlidesPlugin } from '@univerjs/slides';
import { UniverSlidesUIPlugin } from '@univerjs/slides-ui';
import slidesLocale from '@univerjs/slides-ui/locale/en-US';
import { defaultTheme } from '@univerjs/themes';
import { UniverUIPlugin } from '@univerjs/ui';
import uiLocale from '@univerjs/ui/locale/en-US';
import { registerPresentationWebMCP } from '../../../lib/editor-webmcp';
import { normalizePresentationSnapshot, type PresentationSnapshot } from '../../../lib/presentation-operations';
import type { MountedUniverEditor, MountUniverEditorOptions } from './types';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/slides-ui/lib/index.css';

export function mountPresentation({ host, id, name, snapshot, canEdit = true, onSnapshot, onDirty, onPresentationSnapshotChange }: MountUniverEditorOptions): MountedUniverEditor {
  const univer = new Univer({
    locale: LocaleType.EN_US,
    locales: { [LocaleType.EN_US]: mergeLocales(uiLocale, docsUiLocale, slidesLocale) },
    theme: defaultTheme,
  });
  univer.registerPlugin(UniverRenderEnginePlugin);
  univer.registerPlugin(UniverUIPlugin, { container: host });
  univer.registerPlugin(UniverDocsPlugin);
  univer.registerPlugin(UniverDocsUIPlugin);
  univer.registerPlugin(UniverDrawingPlugin);
  univer.registerPlugin(UniverSlidesPlugin);
  univer.registerPlugin(UniverSlidesUIPlugin);

  const instanceService = univer.__getInjector().get(IUniverInstanceService) as IUniverInstanceServiceType;
  const commandService = univer.__getInjector().get(ICommandService) as ICommandServiceType;
  let model = univer.createUnit<PresentationSnapshot, SlideDataModel>(
    UniverInstanceType.UNIVER_SLIDE,
    normalizePresentationSnapshot(snapshot, id, name),
  );
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let applyingRemoteSnapshot = false;
  const save = async () => {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    const next = normalizePresentationSnapshot(model.getSnapshot(), id, name);
    if (onPresentationSnapshotChange) await onPresentationSnapshotChange(next);
    else await onSnapshot(next);
  };
  const subscription = canEdit ? commandService.onCommandExecuted(command => {
    if (applyingRemoteSnapshot || !command.id.startsWith('slide')) return;
    onDirty?.();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void save().catch(() => undefined); }, 350);
  }) : undefined;
  const unregisterWebMCP = registerPresentationWebMCP({
    ownerDocument: host.ownerDocument,
    id,
    name,
    canEdit,
    getSnapshot: () => model.getSnapshot(),
    writeSnapshot: async next => {
      applySnapshot(next);
      onDirty?.();
      await save();
    },
  });

  const applySnapshot = (next: unknown) => {
    applyingRemoteSnapshot = true;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    try {
      instanceService.disposeUnit(model.getUnitId());
      model = univer.createUnit<PresentationSnapshot, SlideDataModel>(
        UniverInstanceType.UNIVER_SLIDE,
        normalizePresentationSnapshot(next, id, name),
      );
    } finally {
      applyingRemoteSnapshot = false;
    }
  };

  return {
    applySnapshot,
    applyPresentationSnapshot: applySnapshot,
    getSnapshot: () => normalizePresentationSnapshot(model.getSnapshot(), id, name),
    dispose() {
      if (saveTimer) void save().catch(() => undefined);
      subscription?.dispose();
      unregisterWebMCP();
      setTimeout(() => univer.dispose(), 0);
    },
  };
}
