import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, UserPlus, X } from 'lucide-react';
import type { FlockdocApi } from '../../lib/api';
import type { FlockdocWorkspace, WorkspaceAssignableRole, WorkspaceInvitation, WorkspaceMember, WorkspaceRole } from '../../types';

interface Props {
  api: FlockdocApi;
  workspace: FlockdocWorkspace;
  currentUserEmail?: string;
  onClose: () => void;
}

function roleLabel(role: WorkspaceRole) {
  return role === 'owner' ? 'Owner' : role === 'manager' ? 'Can manage' : 'Can view';
}

function initials(member: WorkspaceMember) {
  const source = member.username ?? member.email.split('@')[0] ?? member.email;
  const parts = source.split(/[._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : source.slice(0, 2)).toUpperCase();
}

export function WorkspaceShareDialog({ api, workspace, currentUserEmail = '', onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceAssignableRole>('manager');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [busy, setBusy] = useState<string | null>('loading');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [menuEmail, setMenuEmail] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api.listWorkspaceMembers(workspace.id).then(result => {
      if (!active) return;
      setMembers(result.members);
      setInvitations(result.invitations);
      setBusy(null);
      queueMicrotask(() => emailRef.current?.focus());
    }).catch(cause => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : 'Could not load workspace sharing.');
      setBusy(null);
    });
    return () => { active = false; };
  }, [api, workspace.id]);

  useEffect(() => {
    const root = document.getElementById('root');
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    root?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); root?.removeAttribute('inert'); document.body.style.overflow = previousOverflow; previousActive?.focus(); };
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy('invite'); setError(null); setSuccess(null);
    try {
      const response = await api.inviteWorkspaceMember(workspace.id, email, inviteRole);
      if (response.invitation) setInvitations(current => [...current.filter(item => item.email !== response.invitation!.email), response.invitation!]);
      if (response.member) setMembers(current => [...current.filter(item => item.email !== response.member!.email), response.member!]);
      setEmail('');
      setSuccess(response.invitation ? 'Invitation sent. Access begins after this person accepts.' : 'This person already has access.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send the invitation.'); }
    finally { setBusy(null); }
  };

  const changeRole = async (member: WorkspaceMember, role: WorkspaceAssignableRole) => {
    if (busy || member.role === role) return setMenuEmail(null);
    setBusy(member.email); setError(null); setSuccess(null);
    try {
      const response = await api.changeWorkspaceMemberRole(workspace.id, member.email, role);
      setMembers(current => current.map(item => item.email === member.email ? response.member : item));
      setMenuEmail(null); setSuccess(`${member.email} is now ${roleLabel(role).toLowerCase()}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change this role.'); }
    finally { setBusy(null); }
  };

  const remove = async (target: string) => {
    if (busy) return;
    setBusy(target); setError(null); setSuccess(null);
    try {
      await api.removeWorkspaceMember(workspace.id, target);
      setMembers(current => current.filter(item => item.email !== target));
      setInvitations(current => current.filter(item => item.email !== target));
      setConfirmEmail(null); setMenuEmail(null); setSuccess('Access removed.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove access.'); }
    finally { setBusy(null); }
  };

  return createPortal(<div className="share-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-share-title" aria-describedby="workspace-share-description">
      <div className="share-dialog-main">
        <header className="share-dialog-head"><div><h2 id="workspace-share-title">Share “{workspace.name}”</h2><p id="workspace-share-description">Invite people to every Flockdoc in this workspace.</p></div><button type="button" className="share-icon-button" aria-label="Close sharing dialog" onClick={onClose}><X aria-hidden="true" /></button></header>
        <form className="share-invite" onSubmit={submit}><input ref={emailRef} type="email" aria-label="Invite by email" placeholder="Invite by email" value={email} onChange={event => setEmail(event.target.value)} required /><select aria-label="Invite role" value={inviteRole} onChange={event => setInviteRole(event.target.value as WorkspaceAssignableRole)}><option value="manager">Can manage</option><option value="viewer">Can view</option></select><button type="submit" disabled={busy !== null}><UserPlus />{busy === 'invite' ? 'Sending…' : 'Send invite'}</button></form>
        <section className="share-section"><div className="share-section-title"><h3>People and invitations</h3><span>{members.length} with access · {invitations.length} pending</span></div><ul className="share-people">
          {members.map(member => <li key={member.email} className="share-person" aria-label={member.email}><span className={`share-avatar${member.role === 'owner' ? ' owner' : ''}`}>{initials(member)}</span><span className="share-identity"><strong>{member.username ?? member.email}{member.email === currentUserEmail ? ' (you)' : ''}</strong>{member.username ? <span>{member.email}</span> : null}</span>{member.role === 'owner' || !workspace.canManageAccess ? <span className="share-fixed-role">{roleLabel(member.role)}</span> : confirmEmail === member.email ? <span className="share-confirm-remove"><button type="button" className="compact danger" onClick={() => void remove(member.email)}>Confirm remove access</button><button type="button" className="compact secondary" onClick={() => setConfirmEmail(null)}>Cancel</button></span> : <span className="share-role-control"><button type="button" className="share-role-button" aria-label={`Manage access for ${member.email}`} aria-expanded={menuEmail === member.email} onClick={() => setMenuEmail(open => open === member.email ? null : member.email)}>{roleLabel(member.role)} <ChevronDown /></button>{menuEmail === member.email ? <span className="share-role-menu"><button type="button" onClick={() => void changeRole(member, 'manager')}>Can manage</button><button type="button" onClick={() => void changeRole(member, 'viewer')}>Can view</button><button type="button" className="remove" onClick={() => { setConfirmEmail(member.email); setMenuEmail(null); }}>Remove access</button></span> : null}</span>}</li>)}
          {invitations.map(invitation => <li key={invitation.id} className="share-person" aria-label={invitation.email}><span className="share-avatar pending">{invitation.email.slice(0, 2).toUpperCase()}</span><span className="share-identity"><strong>{invitation.email}</strong><span className="tag pending">Invitation pending</span></span><span className="share-pending-control"><span className="share-fixed-role">{roleLabel(invitation.role)}</span>{workspace.canManageAccess ? <button type="button" className="share-icon-button" aria-label={`Cancel invitation for ${invitation.email}`} onClick={() => void remove(invitation.email)}><X /></button> : null}</span></li>)}
        </ul></section>
        {error ? <p className="form-error" role="alert">{error}</p> : null}{success ? <p className="share-success"><Check />{success}</p> : null}
      </div><footer className="share-dialog-footer"><span className="muted">Workspace access applies to its Flockdocs.</span><button type="button" data-done onClick={onClose}>Done</button></footer>
    </div>
  </div>, document.body);
}
