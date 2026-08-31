import { useEffect, useState } from 'react';
import { Bot, Check, Copy, Link2, Trash2, UserRound, X } from 'lucide-react';
import type { FlockdocApi } from '../../lib/api';
import type { FlockdocAccessGrant, FlockdocAssignableRole, FlockdocLinkRole, FlockdocPrincipalType, FlockdocShareLink, FlockdocType } from '../../types';

interface DocumentShareDialogProps {
  api: FlockdocApi;
  flockdocId: string;
  flockdocType?: FlockdocType;
  name: string;
  onClose: () => void;
}

const collaboratorRoles: FlockdocAssignableRole[] = ['viewer', 'commenter', 'editor', 'manager'];
const linkRoles: FlockdocLinkRole[] = ['viewer', 'commenter', 'editor'];

function displayName(grant: FlockdocAccessGrant) {
  return grant.email ?? grant.username ?? grant.principalId;
}

export function DocumentShareDialog({ api, flockdocId, flockdocType = 'paper', name, onClose }: DocumentShareDialogProps) {
  const [grants, setGrants] = useState<FlockdocAccessGrant[]>([]);
  const [links, setLinks] = useState<FlockdocShareLink[]>([]);
  const [principalType, setPrincipalType] = useState<'user' | 'agent'>('user');
  const [principal, setPrincipal] = useState('');
  const [role, setRole] = useState<FlockdocAssignableRole>('editor');
  const [linkRole, setLinkRole] = useState<FlockdocLinkRole>('viewer');
  const [status, setStatus] = useState('Loading sharing settings…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [access, shareLinks] = await Promise.all([api.listAccess(flockdocId), api.listShareLinks(flockdocId)]);
    setGrants(access.grants);
    setLinks(shareLinks.shareLinks.filter(link => !link.revokedAt));
    setStatus('');
  };

  useEffect(() => {
    void refresh().catch(cause => {
      setStatus('');
      setError(cause instanceof Error ? cause.message : 'Unable to load sharing settings.');
    });
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    addEventListener('keydown', onKeyDown);
    return () => removeEventListener('keydown', onKeyDown);
  }, [api, flockdocId]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sharing could not be updated.'); }
    finally { setBusy(false); }
  };

  const addCollaborator = () => void run(async () => {
    const target = principal.trim();
    if (!target) throw new Error(principalType === 'user' ? 'Enter a teammate email.' : 'Enter an agent ID.');
    if (principalType === 'user') await api.grantUserRole(flockdocId, target, role);
    else await api.grantRole(flockdocId, 'agent', target, role);
    setPrincipal('');
    await refresh();
  });

  const updateRole = (grant: FlockdocAccessGrant, nextRole: FlockdocAssignableRole) => void run(async () => {
    if (grant.principalType === 'user' && grant.status === 'pending_account' && grant.email) {
      await api.grantUserRole(flockdocId, grant.email, nextRole);
    } else {
      await api.grantRole(flockdocId, grant.principalType, grant.principalId, nextRole);
    }
    await refresh();
  });

  const removeGrant = (grant: FlockdocAccessGrant) => void run(async () => {
    await api.removeAccess(flockdocId, grant.principalType as FlockdocPrincipalType, grant.principalId);
    await refresh();
  });

  const createLink = () => void run(async () => {
    const { shareLink } = await api.createShareLink(flockdocId, linkRole);
    const url = new URL(`/flockdoc/${flockdocType}/${flockdocId}`, location.origin);
    url.searchParams.set('share', shareLink.token);
    await navigator.clipboard.writeText(url.toString());
    await refresh();
    setStatus('Invite link copied');
  });

  const revokeLink = (linkId: string) => void run(async () => {
    await api.revokeShareLink(flockdocId, linkId);
    await refresh();
  });

  return <div className="share-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="share-dialog" role="dialog" aria-modal="true" aria-label={`Share ${name}`}>
      <header><div><span className="share-dialog-kicker">Document access</span><h2>Share “{name}”</h2></div><button className="icon-button" aria-label="Close sharing" onClick={onClose}><X /></button></header>
      <div className="share-dialog-body">
        <section aria-labelledby="collaborators-title">
          <div className="section-heading"><div><h3 id="collaborators-title">People and agents</h3><p>Add a teammate by email or grant an agent access by ID.</p></div></div>
          <div className="share-add-row">
            <select aria-label="Collaborator type" value={principalType} onChange={event => setPrincipalType(event.target.value as 'user' | 'agent')}><option value="user">Teammate</option><option value="agent">Agent</option></select>
            <input aria-label="Email or agent ID" type={principalType === 'user' ? 'email' : 'text'} value={principal} onChange={event => setPrincipal(event.target.value)} placeholder={principalType === 'user' ? 'name@company.com' : 'agent_id'} />
            <select aria-label="Access role" value={role} onChange={event => setRole(event.target.value as FlockdocAssignableRole)}>{collaboratorRoles.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>
            <button className="primary" disabled={busy} onClick={addCollaborator}>Add collaborator</button>
          </div>
          <ul className="access-list">
            {grants.map(grant => {
              const label = displayName(grant);
              return <li key={`${grant.principalType}:${grant.principalId}`} aria-label={label}>
                <span className={`principal-icon ${grant.principalType}`}>{grant.principalType === 'agent' ? <Bot /> : <UserRound />}</span>
                <span className="principal-name"><strong>{label}</strong><small>{grant.status === 'pending_account' ? 'Invitation pending' : grant.principalType === 'agent' ? 'Agent' : grant.username ?? 'Teammate'}</small></span>
                <select aria-label={`Role for ${label}`} value={grant.role} disabled={busy} onChange={event => updateRole(grant, event.target.value as FlockdocAssignableRole)}>{collaboratorRoles.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>
                <button className="icon-button danger" aria-label={`Remove ${label}`} disabled={busy} onClick={() => removeGrant(grant)}><Trash2 /></button>
              </li>;
            })}
            {!status && grants.length === 0 ? <li className="empty-access">Only you have direct access.</li> : null}
          </ul>
        </section>
        <section className="invite-links" aria-labelledby="invite-links-title">
          <div className="section-heading"><div><h3 id="invite-links-title">Invite links</h3><p>Recipients sign in, claim the selected role, and then open this document.</p></div><Link2 /></div>
          <div className="share-link-row"><select aria-label="Invite link role" value={linkRole} onChange={event => setLinkRole(event.target.value as FlockdocLinkRole)}>{linkRoles.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select><button className="secondary" disabled={busy} onClick={createLink}><Copy /> Create and copy invite link</button></div>
          {links.map(link => <div className="existing-link" key={link.id}><span><Link2 /><span><strong>{link.role[0].toUpperCase() + link.role.slice(1)} invite</strong><small>Created {new Date(link.createdAt).toLocaleDateString()}</small></span></span><button className="text-danger" disabled={busy} onClick={() => revokeLink(link.id)}>Revoke</button></div>)}
        </section>
        {status ? <p className="share-status">{status === 'Invite link copied' ? <Check /> : null}{status}</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </div>
    </section>
  </div>;
}
