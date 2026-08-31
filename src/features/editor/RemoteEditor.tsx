import { useEffect, useRef, useState } from 'react';
import type { FlockdocApi, FlockdocState } from '../../lib/api';
import { SerializedSnapshotSaver } from '../../lib/remote-persistence';
import type { Flockdoc } from '../../types';
import { PaperEditor } from './PaperEditor';
import { SpreadsheetEditor } from './SpreadsheetEditor';
import { DocumentShareDialog } from '../sharing/DocumentShareDialog';

interface RemoteEditorProps {
  api: FlockdocApi;
  item: Flockdoc;
  onBack: () => void;
  onUpdate: (updates: Partial<Flockdoc>) => void;
}

function LoadedRemoteEditor({ api, state, currentItem, onBack, onUpdate }: Omit<RemoteEditorProps, 'item'> & { state: FlockdocState; currentItem: Flockdoc }) {
  const item = { ...state.flockdoc, ...currentItem, snapshot: currentItem.snapshot ?? state.snapshot, headRevision: currentItem.headRevision ?? state.revision };
  const [saver] = useState(() => new SerializedSnapshotSaver(state.revision, (baseRevision, snapshot) =>
    api.saveState(item.id, baseRevision, crypto.randomUUID(), snapshot),
  ));
  const renameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestName = useRef(item.name);
  const [sharing, setSharing] = useState(false);

  useEffect(() => () => clearTimeout(renameTimer.current), []);

  const onRename = (name: string) => {
    latestName.current = name;
    onUpdate({ name, modifiedAt: 'Just now' });
    clearTimeout(renameTimer.current);
    renameTimer.current = setTimeout(() => { void api.rename(item.id, latestName.current); }, 500);
  };
  const onSnapshot = async (snapshot: unknown) => {
    onUpdate({ snapshot, modifiedAt: 'Just now' });
    const revision = await saver.save(snapshot);
    onUpdate({ headRevision: revision });
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
  return <>{item.type === 'paper' ? <PaperEditor {...common} /> : <SpreadsheetEditor {...common} />}{sharing ? <DocumentShareDialog api={api} flockdocId={item.id} flockdocType={item.type} name={item.name} onClose={() => setSharing(false)} /> : null}</>;
}

export function RemoteEditor({ api, item, onBack, onUpdate }: RemoteEditorProps) {
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
  return <LoadedRemoteEditor key={`${item.id}:${state.value.revision}`} api={api} state={state.value} currentItem={item} onBack={onBack} onUpdate={onUpdate} />;
}
