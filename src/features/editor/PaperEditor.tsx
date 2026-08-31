import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import type { Flockdoc } from '../../types';
import type { MountedUniverEditor } from './univer/types';

interface PaperEditorProps {
  item: Flockdoc;
  onBack: () => void;
  onRename: (name: string) => void;
  onSnapshot: (snapshot: unknown) => void | Promise<void>;
  onDirty?: () => void;
  canEdit?: boolean;
  canShare?: boolean;
  onShare?: () => void;
}

export function PaperEditor({ item, onBack, onRename, onSnapshot, onDirty, canEdit = true, canShare = true, onShare }: PaperEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSnapshotRef = useRef(onSnapshot);
  const [status, setStatus] = useState('Loading Univer…');
  onSnapshotRef.current = onSnapshot;

  useEffect(() => {
    let cancelled = false;
    let mounted: MountedUniverEditor | undefined;

    void import('./univer/mount-paper').then(({ mountPaper }) => {
      if (cancelled || !hostRef.current) return;
      mounted = mountPaper({
        host: hostRef.current,
        id: item.id,
        name: item.name,
        snapshot: item.snapshot,
        canEdit,
        onDirty,
        onSnapshot: snapshot => {
          setStatus('Saving…');
          void Promise.resolve(onSnapshotRef.current(snapshot))
            .then(() => setStatus('Saved to Flockfly'))
            .catch(error => setStatus(error instanceof Error && error.name === 'RevisionConflictError'
              ? 'Newer revision available — reopen to refresh'
              : 'Save failed — changes remain in this browser'));
        },
      });
      setStatus(canEdit ? 'Saved' : 'View only');
    }).catch(error => {
      console.error('Failed to load Univer Paper', error);
      setStatus('Unable to load editor');
    });

    return () => {
      cancelled = true;
      mounted?.dispose();
    };
  }, [canEdit, item.id]);

  return <main className="editor-shell univer-shell">
    <header className="editor-header"><button aria-label="Back to workspace" onClick={onBack}><ArrowLeft /></button><div><input className="document-title" aria-label="Paper name" value={item.name} disabled={!canEdit} onChange={event => onRename(event.target.value)} /><span>{status}</span></div><button className="share" disabled={!canShare || !onShare} onClick={onShare}><Share2 /> Share</button><span className="avatar">You</span></header>
    <div ref={hostRef} className="univer-editor-host" aria-label="Paper editor" />
  </main>;
}
