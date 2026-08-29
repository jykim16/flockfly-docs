import { Bot, FileText, MoreHorizontal, Star, Table2 } from 'lucide-react';
import type { Flockdoc } from '../../types';
import { Avatar } from '../../components/Avatar';

export function FlockdocTable({ items, selectedId, onSelect }: { items: Flockdoc[]; selectedId?: string; onSelect: (item: Flockdoc) => void }) {
  return <div className="file-table" role="table" aria-label="Flockdocs">
    <div className="file-row table-head" role="row"><span /><span>Name ↑</span><span>Type</span><span>People & agents</span><span>Modified ↓</span><span /></div>
    {items.map(item => {
      const Icon = item.type === 'paper' ? FileText : Table2;
      return <button type="button" role="row" key={item.id} className={`file-row ${selectedId === item.id ? 'selected' : ''}`} onClick={() => onSelect(item)} onDoubleClick={() => { location.hash = `#/flockdoc/${item.type}/${item.id}`; }}>
        <span className="checkbox" aria-hidden>{selectedId === item.id ? '✓' : ''}</span>
        <span className="file-name"><Icon className={`type-icon ${item.type}`} /><span>{item.name}</span><Star className={item.starred ? 'starred' : ''} /></span>
        <span className="type-label">{item.type === 'paper' ? 'Paper' : 'Spreadsheet'}</span>
        <span className="avatar-stack">{item.collaborators.slice(0, 3).map(p => <Avatar key={p.id} person={p} small />)}{item.collaborators.length > 3 && <i>+{item.collaborators.length - 3}</i>}{item.collaborators.some(p => p.kind === 'agent') && <span className="sr-only"><Bot />Agent collaborator</span>}</span>
        <span className="modified">{item.modifiedAt}</span>
        <MoreHorizontal />
      </button>;
    })}
  </div>;
}
