import { FileText, FolderOpen, Plus, Table2 } from 'lucide-react';

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
    <nav aria-label="Workspace navigation"><a className="active" href="/flockdoc/" aria-current="page"><FolderOpen />My workspace</a></nav>
  </aside>;
}
