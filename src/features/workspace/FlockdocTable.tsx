import { useState } from 'react';
import { Bot, FileText, Folder, Table2 } from 'lucide-react';
import type { Flockdoc, FlockdocFolder } from '../../types';
import { navigateFlockdoc } from '../../lib/navigation';
import { Avatar } from '../../components/Avatar';

interface Props {
  items: Flockdoc[];
  folders: FlockdocFolder[];
  allFolders: FlockdocFolder[];
  onOpenFolder: (id: string) => void;
  onMove: (item: Flockdoc, parentFolderId: string | null) => Promise<void>;
  onDelete: (item: Flockdoc) => Promise<void>;
}

function FlockdocRow({ item, allFolders, onMove, onDelete }: Pick<Props, 'allFolders' | 'onMove' | 'onDelete'> & { item: Flockdoc }) {
  const [mode, setMode] = useState<'idle' | 'move' | 'delete'>('idle');
  const [destination, setDestination] = useState(item.parentFolderId ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const Icon = item.type === 'paper' ? FileText : Table2;
  const canMove = item.permissions?.canEdit ?? true;
  const canDelete = item.permissions?.canDelete ?? true;

  const perform = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); setMode('idle'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.'); setBusy(false); }
  };

  return <div role="row" className={`file-row ${mode !== 'idle' ? 'expanded' : ''}`} aria-label={`${item.name} ${item.type === 'paper' ? 'Paper' : 'Spreadsheet'}`} onClick={event => event.target === event.currentTarget && navigateFlockdoc(`/flockdoc/${item.type}/${item.id}`)}>
    {mode === 'idle' ? <>
      <button type="button" className="file-open file-name" onClick={() => navigateFlockdoc(`/flockdoc/${item.type}/${item.id}`)}><Icon className={`type-icon ${item.type}`} /><span>{item.name}</span></button>
      <span className="type-label">{item.type === 'paper' ? 'Paper' : 'Spreadsheet'}</span>
      <span className="avatar-stack">{item.collaborators.slice(0, 3).map(p => <Avatar key={p.id} person={p} small />)}{item.collaborators.length > 3 && <i>+{item.collaborators.length - 3}</i>}{item.collaborators.some(p => p.kind === 'agent') && <span className="sr-only"><Bot />Agent collaborator</span>}</span>
      <span className="modified">{item.modifiedAt}</span>
      <span className="file-actions">{canMove && <button type="button" onClick={() => setMode('move')} aria-label={`Move ${item.name}`}>Move</button>}{canDelete && <button type="button" className="danger-link" onClick={() => setMode('delete')} aria-label={`Delete ${item.name}`}>Delete</button>}</span>
    </> : <div className="file-row-detail">
      {mode === 'move' ? <><strong>Move “{item.name}”</strong><select aria-label={`Move ${item.name} to`} value={destination} onChange={event => setDestination(event.target.value)}><option value="">My workspace</option>{allFolders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><button type="button" className="primary" disabled={busy} onClick={() => void perform(() => onMove(item, destination || null))}>Confirm move</button></> : <><strong>Delete “{item.name}”?</strong><span className="delete-note">It can be recovered for 30 days.</span><button type="button" className="danger" disabled={busy} onClick={() => void perform(() => onDelete(item))}>Confirm delete</button></>}
      <button type="button" disabled={busy} onClick={() => { setMode('idle'); setError(''); }}>Cancel</button>{error && <span className="form-error">{error}</span>}
    </div>}
  </div>;
}

export function FlockdocTable({ items, folders, allFolders, onOpenFolder, onMove, onDelete }: Props) {
  return <div className="file-table" role="table" aria-label="Flockdocs">
    <div className="file-row table-head" role="row"><span>Name ↑</span><span>Type</span><span>People & agents</span><span>Modified ↓</span><span>Actions</span></div>
    {items.length === 0 && folders.length === 0 && <div className="empty-state"><FileText /><strong>No flockdocs yet</strong><span>Create a Paper, Spreadsheet, or folder to start working.</span></div>}
    {folders.map(folder => <div role="row" aria-label={`${folder.name} Folder`} className="file-row folder-row" key={folder.id}>
      <button type="button" className="file-open file-name" aria-label={`Open ${folder.name}`} onClick={() => onOpenFolder(folder.id)}><Folder className="type-icon folder" /><span>{folder.name}</span></button>
      <span className="type-label">Folder</span><span /><span className="modified">{folder.modifiedAt}</span><span />
    </div>)}
    {items.map(item => <FlockdocRow key={item.id} item={item} allFolders={allFolders} onMove={onMove} onDelete={onDelete} />)}
  </div>;
}
