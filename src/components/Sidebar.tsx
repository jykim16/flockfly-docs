import { AppWindow, FileText, FolderOpen, Plus, Shapes, Table2, Trash2, Users } from 'lucide-react';
import type { FlockdocType, FlockdocWorkspace } from '../types';

interface Props {
  menuOpen: boolean;
  workspaces: FlockdocWorkspace[];
  selectedWorkspaceId: string;
  view: 'active' | 'trash';
  canCreate: boolean;
  onToggleMenu: () => void;
  onCreate: (type: FlockdocType) => void;
  onSelectWorkspace: (id: string) => void;
  onSelectTrash: () => void;
}

export function Sidebar({ menuOpen, workspaces, selectedWorkspaceId, view, canCreate, onToggleMenu, onCreate, onSelectWorkspace, onSelectTrash }: Props) {
  return <aside className="sidebar">
    <div className="new-wrap">
      <button className="new-button" disabled={!canCreate || view === 'trash'} onClick={onToggleMenu} aria-expanded={menuOpen}><Plus size={20} /> New</button>
      {menuOpen && canCreate && view === 'active' && <div className="create-menu" role="menu" aria-label="Create">
        <button role="menuitem" onClick={() => onCreate('paper')}><FileText /> Paper</button>
        <button role="menuitem" onClick={() => onCreate('spreadsheet')}><Table2 /> Spreadsheet</button>
        <button role="menuitem" onClick={() => onCreate('diagram')}><Shapes /> Diagram</button>
        <button role="menuitem" onClick={() => onCreate('webapp')}><AppWindow /> Web App</button>
      </div>}
    </div>
    <nav aria-label="Workspace navigation">
      <span className="sidebar-section-label">Workspaces</span>
      {workspaces.map(workspace => workspace.isDefault
        ? <a key={workspace.id} className={view === 'active' && selectedWorkspaceId === workspace.id ? 'active' : ''} href="/flockdoc/" aria-current={view === 'active' && selectedWorkspaceId === workspace.id ? 'page' : undefined} onClick={event => { event.preventDefault(); onSelectWorkspace(workspace.id); }}><FolderOpen />{workspace.name}</a>
        : <button key={workspace.id} type="button" className={view === 'active' && selectedWorkspaceId === workspace.id ? 'active' : ''} aria-current={view === 'active' && selectedWorkspaceId === workspace.id ? 'page' : undefined} onClick={() => onSelectWorkspace(workspace.id)}><Users />{workspace.name}</button>)}
      <button type="button" className={view === 'trash' ? 'active' : ''} aria-current={view === 'trash' ? 'page' : undefined} onClick={onSelectTrash}><Trash2 />Trash</button>
    </nav>
  </aside>;
}
