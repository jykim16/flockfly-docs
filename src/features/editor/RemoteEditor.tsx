import { useCallback, useEffect, useRef, useState } from 'react';
import { RevisionConflictError, type FlockdocApi, type FlockdocState } from '../../lib/api';
import { SerializedSnapshotSaver } from '../../lib/remote-persistence';
import { FlockdocRealtimeClient, FlockdocRealtimeRecovery, getFlockdocRealtimeClientId, type FlockdocRealtimeEvent } from '../../lib/flockdoc-realtime';
import { RemoteSnapshotSynchronizer } from '../../lib/realtime-snapshot-sync';
import { SnapshotPersistenceGate } from '../../lib/snapshot-persistence-gate';
import { decodeSpreadsheetOperation, initialSpreadsheetRecoveryRevision, shouldCheckpointSpreadsheet, spreadsheetOperationsEnabled, type SpreadsheetOperation } from '../../lib/spreadsheet-operations';
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
  const operationMode = item.type === 'paper' || (item.type === 'spreadsheet' && spreadsheetOperationsEnabled());
  const [clientId] = useState(getFlockdocRealtimeClientId);
  const [saver] = useState(() => new SerializedSnapshotSaver(state.revision, (baseRevision, snapshot) =>
    api.saveState(item.id, baseRevision, crypto.randomUUID(), snapshot, clientId),
  ));
  const [snapshotGate] = useState(() => new SnapshotPersistenceGate(item.snapshot));
  const editVersion = useRef(0);
  const persistedEditVersion = useRef(0);
  const appliedRevision = useRef(initialSpreadsheetRecoveryRevision(state.snapshotRevision, state.revision, operationMode));
  const snapshotRevision = useRef(state.snapshotRevision);
  const operationTail = useRef<Promise<void>>(Promise.resolve());
  const collaborators = useRef(new Map<string, { id: string; name: string; kind: 'person' | 'agent' }>());
  const onUpdateRef = useRef(onUpdate);
  const currentItemSnapshot = useRef(currentItem.snapshot);
  onUpdateRef.current = onUpdate;
  currentItemSnapshot.current = currentItem.snapshot;
  const renameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestName = useRef(item.name);
  const [sharing, setSharing] = useState(false);
  const [newerRevision, setNewerRevision] = useState<number | null>(null);
  const [remoteOperation, setRemoteOperation] = useState<{ revision: number; operation: SpreadsheetOperation } | null>(null);
  const [remotePaperPatch, setRemotePaperPatch] = useState<{ revision: number; patch: PaperTextPatch } | null>(null);
  const [checkpointRevision, setCheckpointRevision] = useState<number | null>(null);
  const closeSharing = useCallback(() => setSharing(false), []);

  useEffect(() => () => clearTimeout(renameTimer.current), []);

  useEffect(() => {
    const snapshotSync = new RemoteSnapshotSynchronizer({
      clientId,
      currentRevision: () => saver.revision,
      hasUnsavedChanges: () => editVersion.current > persistedEditVersion.current,
      load: () => api.getState(item.id),
      apply: next => {
        if (paperCollaboration) paperCollaboration.reset(next.snapshot);
        const normalized = paperCollaboration ? { ...next, snapshot: paperCollaboration.snapshot() } : next;
        saver.revision = next.revision;
        appliedRevision.current = next.revision;
        snapshotRevision.current = next.snapshotRevision;
        snapshotGate.accept(next.snapshot ?? currentItemSnapshot.current);
        setLiveState(normalized);
        setNewerRevision(null);
        onUpdateRef.current({ ...next.flockdoc, snapshot: normalized.snapshot, headRevision: next.revision, modifiedAt: 'Just now' });
      },
      blocked: revision => setNewerRevision(revision),
    });
    const onRealtimeEvent = async (event: FlockdocRealtimeEvent) => {
      if (event.kind === 'revision.committed') {
        await snapshotSync.handle(event);
        return;
      }
      if (event.kind === 'update.committed') {
        if (!operationMode || event.revision <= appliedRevision.current) return;
        if (item.type === 'paper') {
          const operation = decodePaperOperation(event.updateBase64);
          if (!operation || !paperCollaboration) return;
          const patch = event.clientId === clientId ? null : paperCollaboration.applyOperation(operation);
          if (patch) setRemotePaperPatch({ revision: event.revision, patch });
          onUpdateRef.current({ snapshot: paperCollaboration.snapshot(), headRevision: event.revision, modifiedAt: 'Just now' });
        } else {
          const operation = decodeSpreadsheetOperation(event.updateBase64);
          if (!operation) return;
          if (event.clientId !== clientId) setRemoteOperation({ revision: event.revision, operation });
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
      onSnapshotRequired: async revision => { await snapshotSync.refresh(revision); },
    });
    const realtime = new FlockdocRealtimeClient(api, item.id, clientId, onRealtimeEvent, {
      onConnected: () => recovery.recover(),
    });
    void realtime.start();
    return () => realtime.stop();
  }, [api, clientId, item.id, item.type, operationMode, paperCollaboration, saver, snapshotGate]);

  const onRename = (name: string) => {
    latestName.current = name;
    onUpdate({ name, modifiedAt: 'Just now' });
    clearTimeout(renameTimer.current);
    renameTimer.current = setTimeout(() => { void api.rename(item.id, latestName.current); }, 500);
  };
  const onSnapshot = async (snapshot: unknown) => {
    const savingEditVersion = editVersion.current;
    const result = await snapshotGate.persistIfChanged(snapshot, () => {
      onUpdate({ snapshot, modifiedAt: 'Just now' });
      return saver.save(paperCollaboration ? paperCollaboration.checkpoint() : snapshot);
    });
    persistedEditVersion.current = Math.max(persistedEditVersion.current, savingEditVersion);
    if (result.changed) {
      snapshotRevision.current = result.value;
      appliedRevision.current = result.value;
      onUpdate({ headRevision: result.value });
    }
    setCheckpointRevision(null);
  };
  const onDirty = () => { editVersion.current += 1; };
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
    onDirty,
    canEdit: item.permissions?.canEdit ?? false,
    canShare: item.permissions?.canShare ?? false,
    onShare: () => setSharing(true),
  };
  return <>{newerRevision ? <div className="realtime-warning" role="status">Revision {newerRevision} is available. Your unsaved changes are protected; save or reopen to update.</div> : null}{item.type === 'paper' ? <PaperEditor {...common} onPaperSnapshotChange={onPaperSnapshotChange} remotePatch={remotePaperPatch} checkpointRevision={checkpointRevision} /> : <SpreadsheetEditor {...common} onSpreadsheetOperation={operationMode ? onSpreadsheetOperation : undefined} getSpreadsheetRevision={() => appliedRevision.current} remoteOperation={remoteOperation} checkpointRevision={checkpointRevision} />}{sharing ? <DocumentShareDialog api={api} flockdocId={item.id} flockdocType={item.type} name={item.name} currentUserEmail={currentUserEmail} onClose={closeSharing} /> : null}</>;
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
