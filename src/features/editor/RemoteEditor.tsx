import { useCallback, useEffect, useRef, useState } from 'react';
import { RevisionConflictError, type FlockdocApi, type FlockdocState } from '../../lib/api';
import { SerializedCheckpointSaver } from '../../lib/checkpoint-persistence';
import { FlockdocRealtimeClient, FlockdocRealtimeRecovery, getFlockdocRealtimeClientId, type FlockdocRealtimeEvent } from '../../lib/flockdoc-realtime';
import { checkpointDisposition, initialOperationRecoveryRevision } from '../../lib/operation-recovery';
import { decodeSpreadsheetOperation, shouldCheckpointSpreadsheet, type SpreadsheetOperation } from '../../lib/spreadsheet-operations';
import { decodePaperOperation, PaperCollaborationDocument, paperSnapshotForEditor, type PaperTextPatch } from '../../lib/paper-collaboration';
import type { Flockdoc } from '../../types';
import { PaperEditor } from './PaperEditor';
import { SpreadsheetEditor } from './SpreadsheetEditor';
import { DocumentShareDialog } from '../sharing/DocumentShareDialog';

interface RemoteEditorProps {
  api: FlockdocApi;
  item: Flockdoc;
  onBack: () => void;
  onUpdate: (updates: Partial<Flockdoc>) => void;
  currentUserEmail?: string;
}

function LoadedRemoteEditor({ api, state, currentItem, onBack, onUpdate, currentUserEmail }: Omit<RemoteEditorProps, 'item'> & { state: FlockdocState; currentItem: Flockdoc }) {
  const [liveState, setLiveState] = useState(state);
  const [paperCollaboration] = useState(() => currentItem.type === 'paper'
    ? new PaperCollaborationDocument(currentItem.id, state.snapshot ?? currentItem.snapshot)
    : null);
  const storedSnapshot = liveState.snapshot ?? currentItem.snapshot;
  const editorSnapshot = paperCollaboration?.snapshot() ?? paperSnapshotForEditor(storedSnapshot);
  const item = { ...liveState.flockdoc, ...currentItem, snapshot: editorSnapshot, headRevision: liveState.revision };
  const [clientId] = useState(getFlockdocRealtimeClientId);
  const [saver] = useState(() => new SerializedCheckpointSaver(state.revision, (baseRevision, snapshot) =>
    api.saveCheckpoint(item.id, baseRevision, crypto.randomUUID(), snapshot, clientId),
  ));
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
  const [checkpointRevision, setCheckpointRevision] = useState<number | null>(null);
  const closeSharing = useCallback(() => setSharing(false), []);

  useEffect(() => () => clearTimeout(renameTimer.current), []);

  useEffect(() => {
    const refreshCheckpoint = async (targetRevision: number) => {
      if (targetRevision <= appliedRevision.current) return;
      if (editVersion.current > persistedEditVersion.current) {
        setNewerRevision(targetRevision);
        return;
      }
      const next = await api.getState(item.id);
      if (next.snapshotRevision < targetRevision || next.revision <= appliedRevision.current) return;
      if (paperCollaboration) paperCollaboration.reset(next.snapshot);
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
        const disposition = checkpointDisposition(appliedRevision.current, event.revision);
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
        if (item.type === 'paper') {
          const operation = decodePaperOperation(event.updateBase64);
          if (!operation || !paperCollaboration) return;
          const patch = event.clientId === clientId ? null : paperCollaboration.applyOperation(operation);
          if (patch) setRemotePaperPatches(current => [...current, { revision: event.revision, patch }]);
          onUpdateRef.current({ snapshot: paperCollaboration.snapshot(), headRevision: event.revision, modifiedAt: 'Just now' });
        } else {
          const operation = decodeSpreadsheetOperation(event.updateBase64);
          if (!operation) return;
          if (event.clientId !== clientId) setRemoteOperations(current => [...current, { revision: event.revision, operation }]);
        }
        saver.revision = Math.max(saver.revision, event.revision);
        appliedRevision.current = event.revision;
        if (shouldCheckpointSpreadsheet(snapshotRevision.current, event.revision)) setCheckpointRevision(current => current ?? event.revision);
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
      onConnected: () => recovery.recover(),
    });
    void realtime.start();
    return () => realtime.stop();
  }, [api, clientId, item.id, item.type, paperCollaboration, saver]);

  const onRename = (name: string) => {
    latestName.current = name;
    onUpdate({ name, modifiedAt: 'Just now' });
    clearTimeout(renameTimer.current);
    renameTimer.current = setTimeout(() => { void api.rename(item.id, latestName.current); }, 500);
  };
  const onSnapshot = async (snapshot: unknown) => {
    const savingEditVersion = editVersion.current;
    onUpdate({ snapshot, modifiedAt: 'Just now' });
    const revision = await saver.save(paperCollaboration ? paperCollaboration.checkpoint() : snapshot);
    persistedEditVersion.current = Math.max(persistedEditVersion.current, savingEditVersion);
    snapshotRevision.current = revision;
    appliedRevision.current = revision;
    onUpdate({ headRevision: revision });
    setCheckpointRevision(null);
  };
  const onSpreadsheetOperation = (operation: SpreadsheetOperation) => {
    const savingEditVersion = ++editVersion.current;
    const submission = operationTail.current.then(async () => {
      const sequencedOperation = operation.kind === 'spreadsheet.structure.patch'
        ? { ...operation, baseRevision: appliedRevision.current }
        : operation;
      const result = await api.appendSpreadsheetOperation(item.id, crypto.randomUUID(), clientId, sequencedOperation);
      saver.revision = Math.max(saver.revision, result.revision);
      appliedRevision.current = Math.max(appliedRevision.current, result.revision);
      persistedEditVersion.current = Math.max(persistedEditVersion.current, savingEditVersion);
      onUpdate({ headRevision: result.revision, modifiedAt: 'Just now' });
      if (shouldCheckpointSpreadsheet(snapshotRevision.current, result.revision)) setCheckpointRevision(current => current ?? result.revision);
    }).catch(error => {
      if (error instanceof RevisionConflictError) setNewerRevision(error.currentRevision);
      throw error;
    });
    operationTail.current = submission.then(() => undefined, () => undefined);
    return submission;
  };
  const onPaperSnapshotChange = (snapshot: unknown) => {
    if (!paperCollaboration) return Promise.resolve();
    const operation = paperCollaboration.updateFromSnapshot(snapshot);
    onUpdate({ snapshot: paperCollaboration.snapshot(), modifiedAt: 'Just now' });
    if (!operation) return Promise.resolve();
    const savingEditVersion = ++editVersion.current;
    const submission = operationTail.current.then(async () => {
      const result = await api.appendPaperOperation(item.id, crypto.randomUUID(), clientId, operation);
      saver.revision = Math.max(saver.revision, result.revision);
      appliedRevision.current = Math.max(appliedRevision.current, result.revision);
      persistedEditVersion.current = Math.max(persistedEditVersion.current, savingEditVersion);
      onUpdate({ headRevision: result.revision, modifiedAt: 'Just now' });
      if (shouldCheckpointSpreadsheet(snapshotRevision.current, result.revision)) setCheckpointRevision(current => current ?? result.revision);
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
  };
  const clearPaperPatches = useCallback((revision: number) => setRemotePaperPatches(current => current.filter(entry => entry.revision > revision)), []);
  const clearSpreadsheetOperations = useCallback((revision: number) => setRemoteOperations(current => current.filter(entry => entry.revision > revision)), []);
  return <>{newerRevision ? <div className="realtime-warning" role="status">Revision {newerRevision} is available. Your unsaved changes are protected; save or reopen to update.</div> : null}{item.type === 'paper' ? <PaperEditor {...common} onPaperSnapshotChange={onPaperSnapshotChange} remotePatches={remotePaperPatches} onRemotePatchesApplied={clearPaperPatches} checkpointRevision={checkpointRevision} /> : <SpreadsheetEditor {...common} onSpreadsheetOperation={onSpreadsheetOperation} getSpreadsheetRevision={() => appliedRevision.current} remoteOperations={remoteOperations} onRemoteOperationsApplied={clearSpreadsheetOperations} checkpointRevision={checkpointRevision} />}{sharing ? <DocumentShareDialog api={api} flockdocId={item.id} flockdocType={item.type} name={item.name} currentUserEmail={currentUserEmail} onClose={closeSharing} /> : null}</>;
}

export function RemoteEditor({ api, item, onBack, onUpdate, currentUserEmail }: RemoteEditorProps) {
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
  return <LoadedRemoteEditor key={`${item.id}:${state.value.revision}`} api={api} state={state.value} currentItem={item} onBack={onBack} onUpdate={onUpdate} currentUserEmail={currentUserEmail} />;
}
