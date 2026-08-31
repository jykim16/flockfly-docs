import { ChevronRight } from 'lucide-react';
import type { FlockdocFolder } from '../../types';

export function FolderBreadcrumb({ folders, onNavigate }: { folders: FlockdocFolder[]; onNavigate: (id: string | null) => void }) {
  return <nav className="folder-breadcrumb" aria-label="Folder path">
    <button type="button" onClick={() => onNavigate(null)}>My workspace</button>
    {folders.map((folder, index) => <span className="breadcrumb-segment" key={folder.id}>
      <ChevronRight aria-hidden="true" />
      {index === folders.length - 1 ? <span>{folder.name}</span> : <button type="button" onClick={() => onNavigate(folder.id)}>{folder.name}</button>}
    </span>)}
  </nav>;
}
