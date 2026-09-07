import { useCallback, useEffect, useRef, useState } from 'react';
import { RevisionConflictError, type FlockdocApi, type FlockdocState } from '../../lib/api';
import { SerializedCheckpointSaver } from '../../lib/checkpoint-persistence';
import { FlockdocRealtimeClient, FlockdocRealtimeRecovery, getFlockdocRealtimeClientId, type FlockdocRealtimeEvent } from '../../lib/flockdoc-realtime';
import { checkpointDisposition, initialOperationRecoveryRevision, isPairedPaperCheckpoint } from '../../lib/operation-recovery';
import { decodeSpreadsheetOperation, shouldCheckpointSpreadsheet, type SpreadsheetOperation } from '../../lib/spreadsheet-operations';
import { decodePaperOperation, PaperCollaborationDocument, paperSnapshotForEditor, type PaperTextPatch } from '../../lib/paper-collaboration';
import { decodeDiagramOperation, diagramOperation, type DiagramScene } from '../../lib/diagram-operations';
import { decodeWebAppOperation, webAppOperation, type WebAppBundle } from '../../lib/webapp-operations';
import type { Flockdoc } from '../../types';
import { PaperEditor } from './PaperEditor';
import { SpreadsheetEditor } from './SpreadsheetEditor';
import { DiagramEditor } from './DiagramEditor';
import { WebAppEditor } from './WebAppEditor';
import { DocumentShareDialog } from '../sharing/DocumentShareDialog';
import type { FlockdocOutbox } from '../../lib/flockdoc-outbox';

interface RemoteEditorProps {
  api: FlockdocApi;
  outbox: FlockdocOutbox;
  item: Flockdoc;
  onBack: () => void;
  onUpdate: (updates: Partial<Flockdoc>) => void;
  currentUserEmail?: string;
}

function LoadedRemoteEditor({ api, outbox, state, currentItem, onBack, onUpdate, currentUserEmail }: Omit<RemoteEditorProps, 'item'> & { state: FlockdocState; currentItem: Flockdoc }) {
  const [liveState, setLiveState] = useState(state);
  const [paperCollaboration] = useState(() => currentItem.type === 'paper'
    ? new PaperCollaborationDocument(currentItem.id, state.snapshot ?? currentItem.snapshot)
    : null);
  const [paperEditorSnapshot, setPaperEditorSnapshot] = useState<unknown>(() => paperCollaboration?.snapshot());
  const storedSnapshot = liveState.snapshot ?? currentItem.snapshot;
  const editorSnapshot = paperCollaboration ? paperEditorSnapshot : paperSnapshotForEditor(storedSnapshot);
  const item = { ...liveState.flockdoc, ...currentItem, snapshot: editorSnapshot, headRevision: liveState.revision };
  const [clientId] = useState(getFlockdocRealtimeClientId);
  const [offlineQueued, setOfflineQueued] = useState(() => outbox.pending().some(entry => entry.flockdocId === item.id));
  const [saver] = useState(() => new SerializedCheckpointSaver(state.revision, async (baseRevision, snapshot) => {
    outbox.enqueueCheckpoint(item.id, clientId, snapshot);
    setOfflineQueued(true);
    try {
      const revisions = await outbox.flush(api);
      setOfflineQueued(outbox.pending().some(entry => entry.flockdocId === item.id));
      return { revision: revisions.get(item.id) ?? baseRevision };
    } catch (error) {
      setOfflineQueued(true);
      throw error;
    }
  }));
  const editVersion = useRef(0);
  const persistedEditVersion = useRef(0);
  const appliedRevision = useRef(initialOperationRecoveryRevision(state.snapshotRevision));
  const snapshotRevision = useRef(state.snapshotRevision);
  const operationTail = useRef<Promise<void>>(Promise.resolve());
  const collaborators = useRef(new Map<string, { id: string; name: string; kind: 'person' | 'agent' }>());
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const renameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestName = useRef(item.name);
  const [sharing, setSharing] = useState(false);
  const [newerRevision, setNewerRevision] = useState<number | null>(null);
  const [remoteOperations, setRemoteOperations] = useState<Array<{ revision: number; operation: SpreadsheetOperation }>>([]);
  const [remotePaperPatches, setRemotePaperPatches] = useState<Array<{ revision: number; patch: PaperTextPatch }>>([]);
  const [remoteDiagramScenes, setRemoteDiagramScenes] = useState<Array<{ revision: number; scene: DiagramScene }>>([]);
  const [remoteWebAppBundles, setRemoteWebAppBundles] = useState<Array<{ revision: number; bundle: WebAppBundle }>>([]);
  const lastRemotePaperOperation = useRef<{ revision: number; clientId: string } | null>(null);
  const [checkpointRevision, setCheckpointRevision] = useState<number | null>(null);
  const closeSharing = useCallback(() => setSharing(false), []);

  const flushQueued = useCallback(async () => {
    const includesCheckpoint = outbox.pending().some(entry => entry.flockdocId === item.id && entry.kind === 'checkpoint');
    try {
      const revisions = await outbox.flush(api);
      const revision = revisions.get(item.id);
      if (revision !== undefined) {
        saver.revision = Math.max(saver.revision, revision);
        appliedRevision.current = Math.max(appliedRevision.current, revision);
        onUpdateRef.current({ headRevision: revision, modifiedAt: 'Just now' });
      }
      const remainsQueued = outbox.pending().some(entry => entry.flockdocId === item.id);
      if (!remainsQueued) {
        persistedEditVersion.current = editVersion.current;
        if (includesCheckpoint && revision !== undefined) {
          snapshotRevision.current = revision;
          setCheckpointRevision(null);
        }
      }
      setOfflineQueued(remainsQueued);
      return revision;
    } catch (error) {
      setOfflineQueued(outbox.pending().some(entry => entry.flockdocId === item.id));
      if (error instanceof RevisionConflictError) setNewerRevision(error.currentRevision);
      return undefined;
    }
  }, [api, item.id, outbox, saver]);

  useEffect(() => () => clearTimeout(renameTimer.current), []);
  useEffect(() => {
    const flush = () => { void flushQueued(); };
    flush();
    addEventListener('online', flush);
    return () => removeEventListener('online', flush);
  }, [flushQueued]);

  useEffect(() => {
    const refreshCheckpoint = async (targetRevision: number) => {
      if (targetRevision <= appliedRevision.current) return;
      if (editVersion.current > persistedEditVersion.current) {
        setNewerRevision(targetRevision);
        return;
      }
      const next = await api.getState(item.id);
      if (next.snapshotRevision < targetRevision || next.revision <= appliedRevision.current) return;
      if (paperCollaboration) {
        paperCollaboration.reset(next.snapshot);
        setPaperEditorSnapshot(paperCollaboration.snapshot());
      }
      const normalized = paperCollaboration ? { ...next, snapshot: paperCollaboration.snapshot() } : next;
      saver.revision = next.revision;
      appliedRevision.current = next.revision;
      snapshotRevision.current = next.snapshotRevision;
      setLiveState(normalized);
      setNewerRevision(null);
      onUpdateRef.current({ ...next.flockdoc, snapshot: normalized.snapshot, headRevision: next.revision, modifiedAt: 'Just now' });
    };
    const onRealtimeEvent = async (event: FlockdocRealtimeEvent) => {
      if (event.kind === 'revision.committed') {
        const previousPaperOperation = lastRemotePaperOperation.current;
        const pairedPaperCheckpoint = item.type === 'paper' && isPairedPaperCheckpoint(
          appliedRevision.current,
          event,
          previousPaperOperation,
          clientId,
        );
        lastRemotePaperOperation.current = null;
        if (pairedPaperCheckpoint) {
          saver.revision = event.revision;
          appliedRevision.current = event.revision;
          snapshotRevision.current = event.revision;
          onUpdateRef.current({ headRevision: event.revision, modifiedAt: 'Just now' });
          return;
        }
        const disposition = checkpointDisposition(appliedRevision.current, event.revision, event.clientId !== clientId);
        if (disposition === 'advance') {
          saver.revision = event.revision;
          appliedRevision.current = event.revision;
          snapshotRevision.current = event.revision;
          onUpdateRef.current({ headRevision: event.revision, modifiedAt: 'Just now' });
        } else if (disposition === 'reload') {
          await refreshCheckpoint(event.revision);
        }
        return;
      }
      if (event.kind === 'update.committed') {
        if (event.revision <= appliedRevision.current) return;
        lastRemotePaperOperation.current = null;
        if (item.type === 'paper') {
          const operation = decodePaperOperation(event.updateBase64);
          if (!operation || !paperCollaboration) return;
          const patch = event.clientId === clientId ? null : paperCollaboration.applyOperation(operation);
          if (event.clientId !== clientId) lastRemotePaperOperation.current = { revision: event.revision, clientId: event.clientId };
          if (patch) setRemotePaperPatches(current => [...current, { revision: event.revision, patch }]);
          else if (event.clientId !== clientId) setPaperEditorSnapshot(paperCollaboration.snapshot());
          onUpdateRef.current({ snapshot: paperCollaboration.snapshot(), headRevision: event.revision, modifiedAt: 'Just now' });
        } else if (item.type === 'spreadsheet') {
          const operation = decodeSpreadsheetOperation(event.updateBase64);
          if (!operation) return;
          if (event.clientId !== clientId) setRemoteOperations(current => [...current, { revision: event.revision, operation }]);
        } else if (item.type === 'diagram') {
          const operation = decodeDiagramOperation(event.updateBase64);
          if (!operation) return;
          if (event.clientId !== clientId) setRemoteDiagramScenes(current => [...current, { revision: event.revision, scene: operation.scene }]);
          onUpdateRef.current({ snapshot: operation.scene, headRevision: event.revision, modifiedAt: 'Just now' });
        } else if (item.type === 'webapp') {
          const operation = decodeWebAppOperation(event.updateBase64);
          if (!operation) return;
          if (event.clientId !== clientId) setRemoteWebAppBundles(current => [...current, { revision: event.revision, bundle: operation.bundle }]);
          onUpdateRef.current({ snapshot: operation.bundle, headRevision: event.revision, modifiedAt: 'Just now' });
        }
        saver.revision = Math.max(saver.revision, event.revision);
        appliedRevision.current = event.revision;
        if (event.clientId === clientId && !outbox.pending().some(entry => entry.flockdocId === item.id)) {
          persistedEditVersion.current = editVersion.current;
        }
        if (item.type === 'spreadsheet' && shouldCheckpointSpreadsheet(snapshotRevision.current, event.revision)) setCheckpointRevision(current => current ?? event.revision);
        return;
      }
      if (event.clientId === clientId) return;
      if (event.action === 'joined') {
        collaborators.current.set(event.connectionId, {
          id: event.actor.id,
          name: event.actor.displayName,
          kind: event.actor.type === 'agent' ? 'agent' : 'person',
        });
      } else {
        collaborators.current.delete(event.connectionId);
      }
      onUpdateRef.current({ collaborators: [...collaborators.current.values()] });
    };
    const recovery = new FlockdocRealtimeRecovery(api, item.id, {
      currentRevision: () => appliedRevision.current,
      onEvent: onRealtimeEvent,
      onSnapshotRequired: refreshCheckpoint,
    });
    const realtime = new FlockdocRealtimeClient(api, item.id, clientId, onRealtimeEvent, {
      onConnected: async () => {
        await recovery.recover();
        await flushQueued();
      },
    });
    void realtime.start();
    return () => realtime.stop();
  }, [api, clientId, flushQueued, item.id, item.type, outbox, paperCollaboration, saver]);

  const onRename = (name: string) => {
    latestName.current = name;
    onUpdate({ name, modifiedAt: 'Just now' });
    clearTimeout(renameTimer.current);
    renameTimer.current = setTimeout(() => {
      outbox.enqueueRename(item.id, clientId, latestName.current);
      setOfflineQueued(true);
      void flushQueued();
    }, 500);
  };
  const onSnapshot = async (snapshot: unknown) => {
    const savingEditVersion = editVersion.current;
    onUpdate({ snapshot, modifiedAt: 'Just now' });
    await operationTail.current;
    try {
      const revision = await saver.save(paperCollaboration ? paperCollaboration.checkpoint() : snapshot);
      persistedEditVersion.current = Math.max(persistedEditVersion.current, savingEditVersion);
      snapshotRevision.current = revision;
      appliedRevision.current = revision;
      onUpdate({ headRevision: revision });
      setCheckpointRevision(null);
    } catch (error) {
      if (error instanceof RevisionConflictError) setNewerRevision(error.currentRevision);
    }
  };
  const onSpreadsheetOperation = (operation: SpreadsheetOperation) => {
    const savingEditVersion = ++editVersion.current;
    outbox.enqueueSpreadsheet(item.id, clientId, operation);
    setOfflineQueued(true);
    const submission = operationTail.current.then(async () => {
      const revision = await flushQueued();
      if (revision === undefined) return;
      persistedEditVersion.current = Math.max(persistedEditVersion.current, savingEditVersion);
      if (shouldCheckpointSpreadsheet(snapshotRevision.current, revision)) setCheckpointRevision(current => current ?? revision);
    });
    operationTail.current = submission.then(() => undefined, () => undefined);
    return submission;
  };
  const onPaperSnapshotChange = (snapshot: unknown) => {
    if (!paperCollaboration) return Promise.resolve();
    setPaperEditorSnapshot(snapshot);
    const operation = paperCollaboration.updateFromSnapshot(snapshot);
    onUpdate({ snapshot: paperCollaboration.snapshot(), modifiedAt: 'Just now' });
    if (!operation) return Promise.resolve();
    const savingEditVersion = ++editVersion.current;
    outbox.enqueuePaper(item.id, clientId, operation);
    outbox.enqueueCheckpoint(item.id, clientId, paperCollaboration.checkpoint());
    setOfflineQueued(true);
    const submission = operationTail.current.then(async () => {
      const revision = await flushQueued();
      if (revision === undefined) return;
      persistedEditVersion.current = Math.max(persistedEditVersion.current, savingEditVersion);
      snapshotRevision.current = revision;
      appliedRevision.current = revision;
    });
    operationTail.current = submission.then(() => undefined, () => undefined);
    return submission;
  };
  const onDiagramSceneChange = (scene: DiagramScene) => {
    const operation = diagramOperation(scene);
    const savingEditVersion = ++editVersion.current;
    onUpdate({ snapshot: operation.scene, modifiedAt: 'Just now' });
    outbox.enqueueDiagram(item.id, clientId, operation);
    outbox.enqueueCheckpoint(item.id, clientId, operation.scene);
    setOfflineQueued(true);
    const submission = operationTail.current.then(async () => {
      const revision = await flushQueued();
      if (revision === undefined) return;
      persistedEditVersion.current = Math.max(persistedEditVersion.current, savingEditVersion);
      snapshotRevision.current = revision;
      appliedRevision.current = revision;
    });
    operationTail.current = submission.then(() => undefined, () => undefined);
    return submission;
  };
  const onWebAppBundleChange = (bundle: WebAppBundle) => {
    const operation = webAppOperation(bundle);
    const savingEditVersion = ++editVersion.current;
    onUpdate({ snapshot: operation.bundle, modifiedAt: 'Just now' });
    outbox.enqueueWebApp(item.id, clientId, operation);
    outbox.enqueueCheckpoint(item.id, clientId, operation.bundle);
    setOfflineQueued(true);
    const submission = operationTail.current.then(async () => {
      const revision = await flushQueued();
      if (revision === undefined) return;
      persistedEditVersion.current = Math.max(persistedEditVersion.current, savingEditVersion);
      snapshotRevision.current = revision; appliedRevision.current = revision;
    });
    operationTail.current = submission.then(() => undefined, () => undefined);
    return submission;
  };
  const common = {
    item,
    onBack,
    onRename,
    onSnapshot,
    canEdit: item.permissions?.canEdit ?? false,
    canShare: item.permissions?.canShare ?? false,
    onShare: () => setSharing(true),
    persistenceStatus: offlineQueued ? 'Saved in browser — waiting for connection' : undefined,
  };
  const clearPaperPatches = useCallback((revision: number) => setRemotePaperPatches(current => current.filter(entry => entry.revision > revision)), []);
  const clearSpreadsheetOperations = useCallback((revision: number) => setRemoteOperations(current => current.filter(entry => entry.revision > revision)), []);
  const clearDiagramScenes = useCallback((revision: number) => setRemoteDiagramScenes(current => current.filter(entry => entry.revision > revision)), []);
  const clearWebAppBundles = useCallback((revision: number) => setRemoteWebAppBundles(current => current.filter(entry => entry.revision > revision)), []);
  return <>{newerRevision ? <div className="realtime-warning" role="status">Revision {newerRevision} is available. Your unsaved changes are protected; save or reopen to update.</div> : null}{item.type === 'paper'
    ? <PaperEditor {...common} onPaperSnapshotChange={onPaperSnapshotChange} remotePatches={remotePaperPatches} onRemotePatchesApplied={clearPaperPatches} checkpointRevision={checkpointRevision} />
    : item.type === 'spreadsheet'
      ? <SpreadsheetEditor {...common} onSpreadsheetOperation={onSpreadsheetOperation} getSpreadsheetRevision={() => appliedRevision.current} remoteOperations={remoteOperations} onRemoteOperationsApplied={clearSpreadsheetOperations} checkpointRevision={checkpointRevision} />
      : item.type === 'diagram'
        ? <DiagramEditor {...common} onDiagramSceneChange={onDiagramSceneChange} remoteScenes={remoteDiagramScenes} onRemoteScenesApplied={clearDiagramScenes} checkpointRevision={checkpointRevision} />
        : <WebAppEditor {...common} canComment={item.permissions?.canComment ?? false} onWebAppBundleChange={onWebAppBundleChange} remoteBundles={remoteWebAppBundles} onRemoteBundlesApplied={clearWebAppBundles} loadComments={() => api.listComments(item.id).then(response => response.comments)} createComment={(body, anchor) => api.createComment(item.id, body, anchor).then(response => response.comment)} />}{sharing ? <DocumentShareDialog api={api} flockdocId={item.id} flockdocType={item.type} name={item.name} currentUserEmail={currentUserEmail} onClose={closeSharing} /> : null}</>;
}

export function RemoteEditor({ api, outbox, item, onBack, onUpdate, currentUserEmail }: RemoteEditorProps) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: FlockdocState }>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void api.getState(item.id).then(value => {
      if (!active) return;
      setState({ status: 'ready', value });
      onUpdate({ ...value.flockdoc, snapshot: value.snapshot, headRevision: value.revision });
    }).catch(error => {
      if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load this flockdoc.' });
    });
    return () => { active = false; };
  }, [api, item.id]);

  if (state.status === 'loading') return <main className="editor-loading"><strong>Loading from Flockfly…</strong><span>Checking access and fetching the latest revision.</span></main>;
  if (state.status === 'error') return <main className="editor-loading error"><strong>Could not open this flockdoc</strong><span>{state.message}</span><button onClick={onBack}>Back to workspace</button></main>;
  return <LoadedRemoteEditor key={`${item.id}:${state.value.revision}`} api={api} outbox={outbox} state={state.value} currentItem={item} onBack={onBack} onUpdate={onUpdate} currentUserEmail={currentUserEmail} />;
}
