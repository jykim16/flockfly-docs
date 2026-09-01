import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlockdocApi, FlockdocState } from '../../lib/api';
import { SerializedSnapshotSaver } from '../../lib/remote-persistence';
import { FlockdocRealtimeClient, FlockdocRealtimeRecovery, getFlockdocRealtimeClientId, type FlockdocRealtimeEvent } from '../../lib/flockdoc-realtime';
import { RemoteSnapshotSynchronizer } from '../../lib/realtime-snapshot-sync';
import { SnapshotPersistenceGate } from '../../lib/snapshot-persistence-gate';
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
  const item = { ...liveState.flockdoc, ...currentItem, snapshot: liveState.snapshot ?? currentItem.snapshot, headRevision: liveState.revision };
  const [clientId] = useState(getFlockdocRealtimeClientId);
  const [saver] = useState(() => new SerializedSnapshotSaver(state.revision, (baseRevision, snapshot) =>
    api.saveState(item.id, baseRevision, crypto.randomUUID(), snapshot, clientId),
  ));
  const [snapshotGate] = useState(() => new SnapshotPersistenceGate(item.snapshot));
  const editVersion = useRef(0);
  const persistedEditVersion = useRef(0);
  const collaborators = useRef(new Map<string, { id: string; name: string; kind: 'person' | 'agent' }>());
  const onUpdateRef = useRef(onUpdate);
  const currentItemSnapshot = useRef(currentItem.snapshot);
  onUpdateRef.current = onUpdate;
  currentItemSnapshot.current = currentItem.snapshot;
  const renameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestName = useRef(item.name);
  const [sharing, setSharing] = useState(false);
  const [newerRevision, setNewerRevision] = useState<number | null>(null);
  const closeSharing = useCallback(() => setSharing(false), []);

  useEffect(() => () => clearTimeout(renameTimer.current), []);

  useEffect(() => {
    const snapshotSync = new RemoteSnapshotSynchronizer({
      clientId,
      currentRevision: () => saver.revision,
      hasUnsavedChanges: () => editVersion.current > persistedEditVersion.current,
      load: () => api.getState(item.id),
      apply: next => {
        saver.revision = next.revision;
        snapshotGate.accept(next.snapshot ?? currentItemSnapshot.current);
        setLiveState(next);
        setNewerRevision(null);
        onUpdateRef.current({ ...next.flockdoc, snapshot: next.snapshot, headRevision: next.revision, modifiedAt: 'Just now' });
      },
      blocked: revision => setNewerRevision(revision),
    });
    const onRealtimeEvent = async (event: FlockdocRealtimeEvent) => {
      if (event.kind === 'revision.committed') {
        await snapshotSync.handle(event);
        return;
      }
      if (event.kind === 'update.committed') return;
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
      currentRevision: () => saver.revision,
      onEvent: onRealtimeEvent,
      onSnapshotRequired: async revision => { await snapshotSync.refresh(revision); },
    });
    const realtime = new FlockdocRealtimeClient(api, item.id, clientId, onRealtimeEvent, {
      onConnected: () => recovery.recover(),
    });
    void realtime.start();
    return () => realtime.stop();
  }, [api, clientId, item.id, saver, snapshotGate]);

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
      return saver.save(snapshot);
    });
    persistedEditVersion.current = Math.max(persistedEditVersion.current, savingEditVersion);
    if (result.changed) onUpdate({ headRevision: result.value });
  };
  const onDirty = () => { editVersion.current += 1; };
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
  return <>{newerRevision ? <div className="realtime-warning" role="status">Revision {newerRevision} is available. Your unsaved changes are protected; save or reopen to update.</div> : null}{item.type === 'paper' ? <PaperEditor {...common} /> : <SpreadsheetEditor {...common} />}{sharing ? <DocumentShareDialog api={api} flockdocId={item.id} flockdocType={item.type} name={item.name} currentUserEmail={currentUserEmail} onClose={closeSharing} /> : null}</>;
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
