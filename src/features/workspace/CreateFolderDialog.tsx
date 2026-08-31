import { FormEvent, useState } from 'react';

export function CreateFolderDialog({ onCreate, onCancel }: { onCreate: (name: string) => Promise<void> | void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    try { await onCreate(trimmed); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create folder.'); setBusy(false); }
  };

  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onCancel()}>
    <div className="folder-dialog" role="dialog" aria-modal="true" aria-labelledby="create-folder-title">
      <h2 id="create-folder-title">Create folder</h2>
      <form onSubmit={submit}>
        <label>Folder name<input autoFocus aria-label="Folder name" value={name} onChange={event => setName(event.target.value)} /></label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions"><button type="button" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create'}</button></div>
      </form>
    </div>
  </div>;
}
