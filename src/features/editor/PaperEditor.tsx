import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import type { Flockdoc } from '../../types';
import type { MountedUniverEditor } from './univer/types';
import type { PaperTextPatch } from '../../lib/paper-collaboration';

interface PaperEditorProps {
  item: Flockdoc;
  onBack: () => void;
  onRename: (name: string) => void;
  onSnapshot: (snapshot: unknown) => void | Promise<void>;
  onDirty?: () => void;
  onPaperSnapshotChange?: (snapshot: unknown) => void | Promise<void>;
  remotePatches?: Array<{ revision: number; patch: PaperTextPatch }>;
  onRemotePatchesApplied?: (revision: number) => void;
  checkpointRevision?: number | null;
  canEdit?: boolean;
  canShare?: boolean;
  onShare?: () => void;
}

export function PaperEditor({ item, onBack, onRename, onSnapshot, onDirty, onPaperSnapshotChange, remotePatches = [], onRemotePatchesApplied, checkpointRevision, canEdit = true, canShare = true, onShare }: PaperEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef<MountedUniverEditor | undefined>(undefined);
  const mountedSnapshotRef = useRef(item.snapshot);
  const latestSnapshotRef = useRef(item.snapshot);
  const onSnapshotRef = useRef(onSnapshot);
  const [status, setStatus] = useState('Loading Univer…');
  onSnapshotRef.current = onSnapshot;
  latestSnapshotRef.current = item.snapshot;

  useEffect(() => {
    let cancelled = false;
    let mounted: MountedUniverEditor | undefined;

    void import('./univer/mount-paper').then(({ mountPaper }) => {
      if (cancelled || !hostRef.current) return;
      mounted = mountPaper({
        host: hostRef.current,
        id: item.id,
        name: item.name,
        snapshot: latestSnapshotRef.current,
        canEdit,
        onDirty,
        onPaperSnapshotChange,
        onSnapshot: snapshot => {
          setStatus('Saving…');
          void Promise.resolve(onSnapshotRef.current(snapshot))
            .then(() => setStatus('Saved to Flockfly'))
            .catch(error => setStatus(error instanceof Error && error.name === 'RevisionConflictError'
              ? 'Newer revision available — reopen to refresh'
              : 'Save failed — changes remain in this browser'));
        },
      });
      mountedRef.current = mounted;
      mountedSnapshotRef.current = latestSnapshotRef.current;
      setStatus(canEdit ? 'Saved' : 'View only');
    }).catch(error => {
      console.error('Failed to load Univer Paper', error);
      setStatus('Unable to load editor');
    });

    return () => {
      cancelled = true;
      if (mountedRef.current === mounted) mountedRef.current = undefined;
      mounted?.dispose();
    };
  }, [canEdit, item.id]);

  useEffect(() => {
    if (!mountedRef.current || Object.is(mountedSnapshotRef.current, item.snapshot)) return;
    mountedSnapshotRef.current = item.snapshot;
    mountedRef.current.applySnapshot(item.snapshot);
  }, [item.snapshot]);

  useEffect(() => {
    if (!remotePatches.length) return;
    for (const remote of remotePatches) mountedRef.current?.applyPaperPatch?.(remote.patch);
    onRemotePatchesApplied?.(remotePatches[remotePatches.length - 1].revision);
  }, [remotePatches, onRemotePatchesApplied]);

  useEffect(() => {
    if (checkpointRevision === null || checkpointRevision === undefined) return;
    const snapshot = mountedRef.current?.getSnapshot?.();
    if (snapshot) void Promise.resolve(onSnapshotRef.current(snapshot));
  }, [checkpointRevision]);

  return <main className="editor-shell univer-shell">
    <header className="editor-header"><button aria-label="Back to workspace" onClick={onBack}><ArrowLeft /></button><div><input className="document-title" aria-label="Paper name" value={item.name} disabled={!canEdit} onChange={event => onRename(event.target.value)} /><span>{status}</span></div><button className="share" disabled={!canShare || !onShare} onClick={onShare}><Share2 /> Share</button><span className="avatar">You</span></header>
    <div ref={hostRef} className="univer-editor-host" aria-label="Paper editor" />
  </main>;
}
