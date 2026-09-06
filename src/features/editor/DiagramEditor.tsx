import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import type { Flockdoc } from '../../types';
import { normalizeDiagramScene, type DiagramScene } from '../../lib/diagram-operations';
import { registerDiagramWebMCP } from '../../lib/editor-webmcp';

type ExcalidrawApi = {
  updateScene: (scene: { elements: DiagramScene['elements']; captureUpdate?: unknown }) => void;
  getSceneElements: () => readonly DiagramScene['elements'][number][];
};

type ExcalidrawLibraryHandler = (options: { excalidrawAPI: ExcalidrawApi | null }) => void;

function DiagramLibraryCallback({ useHandleLibrary, excalidrawAPI }: { useHandleLibrary: ExcalidrawLibraryHandler; excalidrawAPI: ExcalidrawApi | null }) {
  useHandleLibrary({ excalidrawAPI });
  return null;
}

type ExcalidrawMainMenu = ComponentType<{ children?: ReactNode }> & {
  DefaultItems: {
    SaveAsImage: ComponentType;
    SearchMenu: ComponentType;
    Help: ComponentType;
    ClearCanvas: ComponentType;
  };
};

const FLOCKDOC_EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: true,
    export: false,
    loadScene: false,
    saveAsImage: true,
    saveToActiveFile: false,
    toggleTheme: false,
  },
  tools: { image: false },
};

interface DiagramEditorProps {
  item: Flockdoc;
  onBack: () => void;
  onRename: (name: string) => void;
  onSnapshot: (snapshot: unknown) => void | Promise<void>;
  onDiagramSceneChange?: (scene: DiagramScene) => void | Promise<void>;
  remoteScenes?: Array<{ revision: number; scene: DiagramScene }>;
  onRemoteScenesApplied?: (revision: number) => void;
  checkpointRevision?: number | null;
  canEdit?: boolean;
  canShare?: boolean;
  onShare?: () => void;
  persistenceStatus?: string;
}

function signature(scene: DiagramScene): string {
  return JSON.stringify(scene.elements.map(element => `${element.id}:${String(element.version ?? 0)}:${String(element.isDeleted ?? false)}`));
}

export function DiagramEditor({ item, onBack, onRename, onSnapshot, onDiagramSceneChange, remoteScenes = [], onRemoteScenesApplied, checkpointRevision, canEdit = true, canShare = true, onShare, persistenceStatus }: DiagramEditorProps) {
  const [editor, setEditor] = useState<ComponentType<Record<string, unknown>> | null>(null);
  const [mainMenu, setMainMenu] = useState<ExcalidrawMainMenu | null>(null);
  const [useHandleLibrary, setUseHandleLibrary] = useState<ExcalidrawLibraryHandler | null>(null);
  const [captureNever, setCaptureNever] = useState<unknown>();
  const [api, setApi] = useState<ExcalidrawApi | null>(null);
  const [status, setStatus] = useState('Loading Excalidraw…');
  const latestScene = useRef(normalizeDiagramScene(item.snapshot ?? { elements: [] }));
  const appliedSignature = useRef(signature(latestScene.current));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSnapshotRef = useRef(onSnapshot);
  const onDiagramSceneChangeRef = useRef(onDiagramSceneChange);
  onSnapshotRef.current = onSnapshot;
  onDiagramSceneChangeRef.current = onDiagramSceneChange;

  useEffect(() => {
    let active = true;
    void Promise.all([
      import('@excalidraw/excalidraw'),
      import('@excalidraw/excalidraw/index.css'),
    ]).then(([module]) => {
      if (!active) return;
      setEditor(() => module.Excalidraw as ComponentType<Record<string, unknown>>);
      setMainMenu(() => module.MainMenu as ExcalidrawMainMenu);
      setUseHandleLibrary(() => module.useHandleLibrary as ExcalidrawLibraryHandler);
      setCaptureNever(module.CaptureUpdateAction.NEVER);
      setStatus(canEdit ? 'Saved' : 'View only');
    }).catch(error => {
      console.error('Failed to load Excalidraw Diagram', error);
      setStatus('Unable to load editor');
    });
    return () => { active = false; clearTimeout(saveTimer.current); };
  }, [canEdit, item.id]);

  useEffect(() => {
    const previousName = window.name;
    window.name = `flockdoc${item.id.replace(/[^a-z0-9]/gi, '')}`;
    return () => { window.name = previousName; };
  }, [item.id]);

  useEffect(() => {
    if (!remoteScenes.length || !api) return;
    for (const remote of remoteScenes) {
      latestScene.current = normalizeDiagramScene(remote.scene);
      appliedSignature.current = signature(latestScene.current);
      api.updateScene({ elements: latestScene.current.elements, captureUpdate: captureNever });
    }
    onRemoteScenesApplied?.(remoteScenes[remoteScenes.length - 1].revision);
  }, [api, captureNever, onRemoteScenesApplied, remoteScenes]);

  useEffect(() => {
    if (!api) return;
    const scene = normalizeDiagramScene(item.snapshot ?? { elements: [] });
    const nextSignature = signature(scene);
    if (nextSignature === appliedSignature.current) return;
    latestScene.current = scene;
    appliedSignature.current = nextSignature;
    api.updateScene({ elements: scene.elements, captureUpdate: captureNever });
  }, [api, captureNever, item.snapshot]);

  useEffect(() => {
    if (checkpointRevision === null || checkpointRevision === undefined) return;
    void Promise.resolve(onSnapshotRef.current(latestScene.current));
  }, [checkpointRevision]);

  useEffect(() => {
    if (!api) return;
    return registerDiagramWebMCP({
      ownerDocument: document,
      id: item.id,
      name: item.name,
      canEdit,
      getScene: () => latestScene.current,
      writeScene: async nextScene => {
        const scene = normalizeDiagramScene(nextScene);
        latestScene.current = scene;
        appliedSignature.current = signature(scene);
        api.updateScene({ elements: scene.elements, captureUpdate: captureNever });
        setStatus('Saving…');
        const save = onDiagramSceneChangeRef.current ?? onSnapshotRef.current;
        try {
          await save(scene);
          setStatus('Saved to Flockfly');
        } catch (error) {
          setStatus(error instanceof Error && error.name === 'RevisionConflictError'
            ? 'Newer revision available — reopen to refresh'
            : 'Save failed — changes remain in this browser');
          throw error;
        }
      },
    });
  }, [api, canEdit, captureNever, item.id, item.name]);

  const onChange = (elements: readonly DiagramScene['elements'][number][]) => {
    const scene = normalizeDiagramScene({ elements });
    const nextSignature = signature(scene);
    if (nextSignature === appliedSignature.current) return;
    appliedSignature.current = nextSignature;
    latestScene.current = scene;
    clearTimeout(saveTimer.current);
    setStatus('Saving…');
    saveTimer.current = setTimeout(() => {
      const save = onDiagramSceneChangeRef.current ?? onSnapshotRef.current;
      void Promise.resolve(save(scene))
        .then(() => setStatus('Saved to Flockfly'))
        .catch(error => setStatus(error instanceof Error && error.name === 'RevisionConflictError'
          ? 'Newer revision available — reopen to refresh'
          : 'Save failed — changes remain in this browser'));
    }, 500);
  };

  const Excalidraw = editor;
  const MainMenu = mainMenu;
  const libraryReturnUrl = `${location.origin}${location.pathname}`;
  return <main className="editor-shell diagram-shell">
    <header className="editor-header"><button aria-label="Back to workspace" onClick={onBack}><ArrowLeft /></button><div><input className="document-title" aria-label="Diagram name" value={item.name} disabled={!canEdit} onChange={event => onRename(event.target.value)} /><span>{persistenceStatus ?? status}</span></div><button className="share" disabled={!canShare || !onShare} onClick={onShare}><Share2 /> Share</button><span className="avatar">You</span></header>
    <div className="diagram-editor-host" aria-label="Diagram editor">{Excalidraw && MainMenu ? <Excalidraw excalidrawAPI={(value: ExcalidrawApi) => setApi(value)} initialData={{ elements: latestScene.current.elements, scrollToContent: true }} viewModeEnabled={!canEdit} theme="light" aiEnabled={false} libraryReturnUrl={libraryReturnUrl} UIOptions={FLOCKDOC_EXCALIDRAW_UI_OPTIONS} onChange={onChange}>
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.Help />
        <MainMenu.DefaultItems.ClearCanvas />
      </MainMenu>
    </Excalidraw> : null}</div>
    {useHandleLibrary ? <DiagramLibraryCallback useHandleLibrary={useHandleLibrary} excalidrawAPI={api} /> : null}
  </main>;
}
