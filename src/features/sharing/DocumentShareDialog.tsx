import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Copy, Globe2, LockKeyhole, UserPlus, X } from 'lucide-react';
import type { FlockdocApi } from '../../lib/api';
import { flockdocAssignableRoles, flockdocRoleLabel } from '../../lib/flockdoc-roles';
import type { FlockdocAssignableRole, FlockdocInvitation, FlockdocMember, FlockdocType, FlockdocVisibility } from '../../types';

interface Props {
  api: FlockdocApi;
  flockdocId: string;
  flockdocType: FlockdocType;
  name: string;
  currentUserEmail?: string;
  onClose: () => void;
}

function initials(member: FlockdocMember) {
  const source = member.username ?? member.email.split('@')[0] ?? member.email;
  const parts = source.split(/[._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : source.slice(0, 2)).toUpperCase();
}

export function DocumentShareDialog({ api, flockdocId, flockdocType, name, currentUserEmail = '', onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<FlockdocAssignableRole>('manager');
  const [members, setMembers] = useState<FlockdocMember[]>([]);
  const [invitations, setInvitations] = useState<FlockdocInvitation[]>([]);
  const [visibility, setVisibilityState] = useState<FlockdocVisibility>('private');
  const [canInvite, setCanInvite] = useState(false);
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [busy, setBusy] = useState<string | null>('loading');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [menuEmail, setMenuEmail] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api.listMembers(flockdocId).then(result => {
      if (!active) return;
      setMembers(result.members);
      setInvitations(result.invitations);
      setVisibilityState(result.flockdoc.visibility ?? 'private');
      setCanInvite(result.flockdoc.permissions?.canShare === true);
      setCanManageAccess(result.flockdoc.permissions?.canDelete === true);
      setBusy(null);
      queueMicrotask(() => (result.flockdoc.permissions?.canShare ? emailRef.current : dialogRef.current?.querySelector<HTMLElement>('[data-done]'))?.focus());
    }).catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : 'Could not load sharing.'); setBusy(null); } });
    return () => { active = false; };
  }, [api, flockdocId]);

  useEffect(() => {
    const root = document.getElementById('root');
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    root?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )].filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      root?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      previousActive?.focus();
    };
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy('invite'); setError(null); setSuccess(null);
    try {
      const response = await api.inviteMember(flockdocId, email, inviteRole);
      if (response.invitation) setInvitations(current => [...current.filter(item => item.email !== response.invitation!.email), response.invitation!]);
      if (response.member) setMembers(current => [...current.filter(item => item.email !== response.member!.email), response.member!]);
      setEmail('');
      setSuccess(response.invitation ? 'Invitation sent. Access begins after this person accepts.' : 'This person already has access.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send the invitation.'); }
    finally { setBusy(null); }
  };

  const changeRole = async (member: FlockdocMember, role: FlockdocAssignableRole) => {
    if (busy || member.role === role) return setMenuEmail(null);
    setBusy(member.email); setError(null); setSuccess(null);
    try {
      const response = await api.changeMemberRole(flockdocId, member.email, role);
      setMembers(current => current.map(item => item.email === member.email ? response.member : item));
      setMenuEmail(null); setSuccess(`${member.email} is now ${flockdocRoleLabel(role).toLowerCase()}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change this role.'); }
    finally { setBusy(null); }
  };

  const remove = async (target: string) => {
    if (busy) return;
    setBusy(target); setError(null); setSuccess(null);
    try {
      await api.removeMember(flockdocId, target);
      setMembers(current => current.filter(item => item.email !== target));
      setInvitations(current => current.filter(item => item.email !== target));
      setConfirmEmail(null); setSuccess('Access removed.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove access.'); }
    finally { setBusy(null); }
  };

  const changeVisibility = async (next: FlockdocVisibility) => {
    if (!canManageAccess || busy || visibility === next) return;
    const previous = visibility; setVisibilityState(next); setBusy('visibility'); setError(null);
    try { const response = await api.setVisibility(flockdocId, next); setVisibilityState(response.flockdoc.visibility ?? next); }
    catch (cause) { setVisibilityState(previous); setError(cause instanceof Error ? cause.message : 'Could not change general access.'); }
    finally { setBusy(null); }
  };

  const copyLink = async () => {
    try {
      const url = new URL(`/flockdoc/${flockdocType}/${flockdocId}`, location.origin);
      await navigator.clipboard.writeText(url.toString()); setSuccess('Link copied');
    } catch { setError('Could not copy the document link.'); }
  };

  return createPortal(<div className="share-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="flockdoc-share-title" aria-describedby="flockdoc-share-description">
      <div className="share-dialog-main">
        <header className="share-dialog-head"><div><h2 id="flockdoc-share-title">Share “{name}”</h2><p id="flockdoc-share-description">Invite people and choose how this document can be opened.</p></div><button type="button" className="share-icon-button" aria-label="Close sharing dialog" onClick={onClose}><X aria-hidden="true" /></button></header>
        {canInvite ? <form className="share-invite" onSubmit={submit}><input ref={emailRef} type="email" aria-label="Invite by email" placeholder="Invite by email" value={email} onChange={event => setEmail(event.target.value)} required /><select aria-label="Invite role" value={inviteRole} onChange={event => setInviteRole(event.target.value as FlockdocAssignableRole)}>{flockdocAssignableRoles.map(role => <option key={role} value={role}>{flockdocRoleLabel(role)}</option>)}</select><button type="submit" disabled={busy !== null}><UserPlus />{busy === 'invite' ? 'Sending…' : 'Send invite'}</button></form> : null}
        <section className="share-section"><div className="share-section-title"><h3>People and invitations</h3><span>{members.length} with access · {invitations.length} pending</span></div><ul className="share-people">
          {members.map(member => <li key={member.email} className="share-person" aria-label={member.email}><span className={`share-avatar${member.role === 'owner' ? ' owner' : ''}`}>{initials(member)}</span><span className="share-identity"><strong>{member.username ?? member.email}{member.email === currentUserEmail ? ' (you)' : ''}</strong>{member.username ? <span>{member.email}</span> : null}</span>{member.role === 'owner' || !canManageAccess ? <span className="share-fixed-role">{flockdocRoleLabel(member.role)}</span> : confirmEmail === member.email ? <span className="share-confirm-remove"><button className="compact danger" onClick={() => void remove(member.email)}>Confirm remove access</button><button className="compact secondary" onClick={() => setConfirmEmail(null)}>Cancel</button></span> : <span className="share-role-control"><button className="share-role-button" aria-label={`Manage access for ${member.email}`} aria-expanded={menuEmail === member.email} onClick={() => setMenuEmail(open => open === member.email ? null : member.email)}>{flockdocRoleLabel(member.role)} <ChevronDown /></button>{menuEmail === member.email ? <span className="share-role-menu">{flockdocAssignableRoles.map(role => <button key={role} onClick={() => void changeRole(member, role)}>{flockdocRoleLabel(role)}</button>)}<button className="remove" onClick={() => { setConfirmEmail(member.email); setMenuEmail(null); }}>Remove access</button></span> : null}</span>}</li>)}
          {invitations.map(invitation => <li key={invitation.id} className="share-person" aria-label={invitation.email}><span className="share-avatar pending">{invitation.email.slice(0, 2).toUpperCase()}</span><span className="share-identity"><strong>{invitation.email}</strong><span className="tag pending">Invitation pending</span></span><span className="share-pending-control"><span className="share-fixed-role">{flockdocRoleLabel(invitation.role)}</span>{canManageAccess ? <button className="share-icon-button" aria-label={`Cancel invitation for ${invitation.email}`} onClick={() => void remove(invitation.email)}><X /></button> : null}</span></li>)}
        </ul></section>
        <section className="share-section"><div className="share-section-title"><h3>General access</h3><span>Public access is view only</span></div><div className="share-access-options">{(['private', 'public'] as const).map(option => <label key={option} className={`share-access-option${visibility === option ? ' selected' : ''}`}><input aria-label={option === 'public' ? 'Public' : 'Restricted'} type="radio" name="flockdoc-visibility" checked={visibility === option} disabled={!canManageAccess || busy !== null} onChange={() => void changeVisibility(option)} /><span className="share-access-icon">{option === 'public' ? <Globe2 /> : <LockKeyhole />}</span><span className="share-access-copy"><strong>{option === 'public' ? 'Public' : 'Restricted'}</strong><span>{option === 'public' ? 'Anyone with the link can open and add it as Can view.' : 'Only people listed above can open this document.'}</span></span><span className="share-radio-mark" /></label>)}</div><p className="share-access-note"><Check /><span><strong>{visibility === 'public' ? 'Public · Can view.' : 'Restricted.'}</strong> {visibility === 'public' ? 'Existing member roles stay unchanged.' : 'Only listed people keep access.'}</span></p></section>
        {error ? <p className="form-error" role="alert">{error}</p> : null}{success && success !== 'Link copied' ? <p className="share-success"><Check />{success}</p> : null}
      </div><footer className="share-dialog-footer"><button type="button" className={`secondary share-copy${success === 'Link copied' ? ' copied' : ''}`} onClick={() => void copyLink()}>{success === 'Link copied' ? <Check /> : <Copy />}<span>{success === 'Link copied' ? 'Link copied' : 'Copy link'}</span></button><button type="button" data-done onClick={onClose}>Done</button></footer>
    </div>
  </div>, document.body);
}
