interface EditorDocumentTitleProps {
  ariaLabel: string;
  name: string;
  workspaceName: string;
  status: string;
  canEdit: boolean;
  onRename: (name: string) => void;
}

export function EditorDocumentTitle({ ariaLabel, name, workspaceName, status, canEdit, onRename }: EditorDocumentTitleProps) {
  return <div className="editor-document-title">
    <input className="document-title" aria-label={ariaLabel} value={name} disabled={!canEdit} onChange={event => onRename(event.target.value)} />
    <div className="editor-document-meta">
      <span>Workspace: {workspaceName}</span>
      <span aria-hidden="true">·</span>
      <span>{status}</span>
    </div>
  </div>;
}
