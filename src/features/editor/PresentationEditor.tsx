import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import type { Flockdoc } from '../../types';
import type { PresentationSnapshot } from '../../lib/presentation-operations';
import type { MountedUniverEditor } from './univer/types';

interface PresentationEditorProps {
  item: Flockdoc;
  onBack: () => void;
  onRename: (name: string) => void;
  onSnapshot: (snapshot: unknown) => void | Promise<void>;
  onDirty?: () => void;
  onPresentationSnapshotChange?: (snapshot: PresentationSnapshot) => void | Promise<void>;
  remoteSnapshots?: Array<{ revision: number; snapshot: PresentationSnapshot }>;
  onRemoteSnapshotsApplied?: (revision: number) => void;
  checkpointRevision?: number | null;
  canEdit?: boolean;
  canShare?: boolean;
  onShare?: () => void;
  persistenceStatus?: string;
}

function snapshotSignature(snapshot: unknown): string | undefined {
  try { return JSON.stringify(snapshot); } catch { return undefined; }
}

export function PresentationEditor({ item, onBack, onRename, onSnapshot, onDirty, onPresentationSnapshotChange, remoteSnapshots = [], onRemoteSnapshotsApplied, checkpointRevision, canEdit = true, canShare = true, onShare, persistenceStatus }: PresentationEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef<MountedUniverEditor | undefined>(undefined);
  const mountedSnapshotRef = useRef(item.snapshot);
  const mountedSnapshotSignatureRef = useRef(snapshotSignature(item.snapshot));
  const latestSnapshotRef = useRef(item.snapshot);
  const onSnapshotRef = useRef(onSnapshot);
  const onPresentationSnapshotChangeRef = useRef(onPresentationSnapshotChange);
  const [status, setStatus] = useState('Loading Univer…');
  latestSnapshotRef.current = item.snapshot;
  onSnapshotRef.current = onSnapshot;
  onPresentationSnapshotChangeRef.current = onPresentationSnapshotChange;

  useEffect(() => {
    let cancelled = false;
    let mounted: MountedUniverEditor | undefined;
    void import('./univer/mount-presentation').then(({ mountPresentation }) => {
      if (cancelled || !hostRef.current) return;
      mounted = mountPresentation({
        host: hostRef.current,
        id: item.id,
        name: item.name,
        snapshot: latestSnapshotRef.current,
        canEdit,
        onDirty,
        onPresentationSnapshotChange: onPresentationSnapshotChange ? snapshot => {
          mountedSnapshotRef.current = snapshot;
          mountedSnapshotSignatureRef.current = snapshotSignature(snapshot);
          return onPresentationSnapshotChangeRef.current?.(snapshot);
        } : undefined,
        onSnapshot: snapshot => {
          mountedSnapshotRef.current = snapshot;
          mountedSnapshotSignatureRef.current = snapshotSignature(snapshot);
          setStatus('Saving…');
          return Promise.resolve(onSnapshotRef.current(snapshot)).then(() => setStatus('Saved to Flockfly')).catch(() => setStatus('Save failed — changes remain in this browser'));
        },
      });
      mountedRef.current = mounted;
      mountedSnapshotRef.current = latestSnapshotRef.current;
      mountedSnapshotSignatureRef.current = snapshotSignature(latestSnapshotRef.current);
      setStatus(canEdit ? 'Saved' : 'View only');
    }).catch(error => { console.error('Failed to load Univer Presentation', error); setStatus('Unable to load editor'); });
    return () => { cancelled = true; if (mountedRef.current === mounted) mountedRef.current = undefined; mounted?.dispose(); };
  }, [canEdit, item.id]);

  useEffect(() => {
    if (!mountedRef.current || Object.is(mountedSnapshotRef.current, item.snapshot)) return;
    const nextSignature = snapshotSignature(item.snapshot);
    if (nextSignature !== undefined && nextSignature === mountedSnapshotSignatureRef.current) {
      mountedSnapshotRef.current = item.snapshot;
      return;
    }
    mountedSnapshotRef.current = item.snapshot;
    mountedSnapshotSignatureRef.current = nextSignature;
    mountedRef.current.applySnapshot(item.snapshot);
  }, [item.snapshot]);

  useEffect(() => {
    if (!remoteSnapshots.length) return;
    for (const remote of remoteSnapshots) {
      mountedRef.current?.applyPresentationSnapshot?.(remote.snapshot);
      mountedSnapshotRef.current = remote.snapshot;
      mountedSnapshotSignatureRef.current = snapshotSignature(remote.snapshot);
    }
    onRemoteSnapshotsApplied?.(remoteSnapshots[remoteSnapshots.length - 1].revision);
  }, [remoteSnapshots, onRemoteSnapshotsApplied]);

  useEffect(() => {
    if (checkpointRevision === null || checkpointRevision === undefined) return;
    const snapshot = mountedRef.current?.getSnapshot?.();
    if (snapshot) void Promise.resolve(onSnapshotRef.current(snapshot));
  }, [checkpointRevision]);

  return <main className="editor-shell univer-shell">
    <header className="editor-header"><button aria-label="Back to workspace" onClick={onBack}><ArrowLeft /></button><div><input className="document-title" aria-label="Presentation name" value={item.name} disabled={!canEdit} onChange={event => onRename(event.target.value)} /><span>{persistenceStatus ?? status}</span></div><button className="share" disabled={!canShare || !onShare} onClick={onShare}><Share2 /> Share</button><span className="avatar">You</span></header>
    <div ref={hostRef} className="univer-editor-host presentation-editor-host" aria-label="Presentation editor" />
  </main>;
}
