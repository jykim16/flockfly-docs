import { ChevronRight } from 'lucide-react';
export function FolderBreadcrumb({ workspaceName, prefix, onNavigate }: { workspaceName: string; prefix: string; onNavigate: (prefix: string) => void }) {
  const segments = prefix.split('/').filter(Boolean);
  return <nav className="folder-breadcrumb" aria-label="Folder path">
    <button type="button" onClick={() => onNavigate('')}>{workspaceName}</button>
    {segments.map((segment, index) => <span className="breadcrumb-segment" key={`${segments.slice(0, index + 1).join('/')}/`}>
      <ChevronRight aria-hidden="true" />
      {index === segments.length - 1 ? <span>{segment}</span> : <button type="button" onClick={() => onNavigate(`${segments.slice(0, index + 1).join('/')}/`)}>{segment}</button>}
    </span>)}
  </nav>;
}
