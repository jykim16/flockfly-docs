import { Bot, FileText, Table2 } from 'lucide-react';
import type { Flockdoc } from '../../types';
import { navigateFlockdoc } from '../../lib/navigation';
import { Avatar } from '../../components/Avatar';

export function FlockdocTable({ items }: { items: Flockdoc[] }) {
  return <div className="file-table" role="table" aria-label="Flockdocs">
    <div className="file-row table-head" role="row"><span>Name ↑</span><span>Type</span><span>People & agents</span><span>Modified ↓</span></div>
    {items.length === 0 && <div className="empty-state"><FileText /><strong>No flockdocs yet</strong><span>Create a Paper or Spreadsheet to start working.</span></div>}
    {items.map(item => {
      const Icon = item.type === 'paper' ? FileText : Table2;
      return <button type="button" role="row" key={item.id} className="file-row" onClick={() => navigateFlockdoc(`/flockdoc/${item.type}/${item.id}`)}>
        <span className="file-name"><Icon className={`type-icon ${item.type}`} /><span>{item.name}</span></span>
        <span className="type-label">{item.type === 'paper' ? 'Paper' : 'Spreadsheet'}</span>
        <span className="avatar-stack">{item.collaborators.slice(0, 3).map(p => <Avatar key={p.id} person={p} small />)}{item.collaborators.length > 3 && <i>+{item.collaborators.length - 3}</i>}{item.collaborators.some(p => p.kind === 'agent') && <span className="sr-only"><Bot />Agent collaborator</span>}</span>
        <span className="modified">{item.modifiedAt}</span>
      </button>;
    })}
  </div>;
}
