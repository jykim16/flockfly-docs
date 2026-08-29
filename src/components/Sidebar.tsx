import { FileText, FolderOpen, Home, Plus, Share2, Star, Table2, Trash2 } from 'lucide-react';

const nav = [
  [Home, 'Home'], [FolderOpen, 'My workspace'], [Share2, 'Shared with me'], [Star, 'Starred'], [Trash2, 'Trash'],
] as const;

export function Sidebar({ menuOpen, onToggleMenu, onCreate }: { menuOpen: boolean; onToggleMenu: () => void; onCreate: (type: 'paper' | 'spreadsheet' | 'folder') => void }) {
  return <aside className="sidebar">
    <div className="new-wrap">
      <button className="new-button" onClick={onToggleMenu} aria-expanded={menuOpen}><Plus size={20} /> New</button>
      {menuOpen && <div className="create-menu" role="menu" aria-label="Create">
        <button role="menuitem" onClick={() => onCreate('paper')}><FileText /> Paper</button>
        <button role="menuitem" onClick={() => onCreate('spreadsheet')}><Table2 /> Spreadsheet</button>
        <button role="menuitem" onClick={() => onCreate('folder')}><FolderOpen /> Folder</button>
      </div>}
    </div>
    <nav aria-label="Workspace navigation">{nav.map(([Icon, label]) => <button key={label} className={label === 'My workspace' ? 'active' : ''}><Icon />{label}</button>)}</nav>
    <div className="storage"><span>Storage</span><small>Storage data unavailable</small><button disabled>Manage storage</button></div>
  </aside>;
}
