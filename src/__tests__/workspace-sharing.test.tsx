import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

afterEach(() => vi.unstubAllGlobals());

describe('workspace sharing', () => {
  it('shares the selected collection from the Flockdoc page with manager or viewer access', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/v1/me') return new Response(JSON.stringify({ user: { id: 'user-owner', email: 'owner@example.com' } }), { status: 200 });
      if (url === '/v1/collections') return new Response(JSON.stringify({ collections: [
        { id: 'coll_personal', kind: 'private', name: "Owner's sessions", personalOwnerUserId: 'user-owner', isMember: true, permissions: { canPublish: true, canInviteMembers: true, canRemoveMembers: true } },
        { id: 'coll_team', kind: 'private', name: 'Design team', personalOwnerUserId: null, isMember: true, permissions: { canPublish: true, canInviteMembers: true, canRemoveMembers: true } },
      ] }), { status: 200 });
      if (url === '/v1/flockdocs?collectionId=coll_personal' || url === '/v1/flockdocs?collectionId=coll_team') return new Response(JSON.stringify({ flockdocs: [] }), { status: 200 });
      if (url === '/v1/flockdoc-invitations') return new Response(JSON.stringify({ invitations: [] }), { status: 200 });
      if (url === '/v1/collections/coll_team/members' && (!init?.method || init.method === 'GET')) return new Response(JSON.stringify({
        members: [{ email: 'owner@example.com', username: 'Owner', role: 'owner', status: 'active' }],
        invitations: [],
      }), { status: 200 });
      if (url === '/v1/collections/coll_team/members' && init?.method === 'POST') return new Response(JSON.stringify({
        invitation: { id: 'cinv_1', collectionId: 'coll_team', collectionName: 'Design team', email: 'viewer@example.com', role: 'viewer', invitedByUserId: 'user-owner', createdAt: '2026-09-07T00:00:00Z' },
      }), { status: 201 });
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    const navigation = await screen.findByRole('navigation', { name: 'Workspace navigation' });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Design team' }));
    expect(await screen.findByRole('heading', { name: 'Design team' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share workspace' }));

    const dialog = await screen.findByRole('dialog', { name: 'Share “Design team”' });
    expect(within(dialog).getByText('owner@example.com')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Invite by email'), { target: { value: 'viewer@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Invite role'), { target: { value: 'viewer' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send invite' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/v1/collections/coll_team/members', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'viewer@example.com', role: 'viewer' }),
    })));
    expect(await within(dialog).findByText('viewer@example.com')).toBeInTheDocument();
    expect(within(dialog).getByText('Invitation pending')).toBeInTheDocument();
  });

  it('does not offer workspace sharing to collection viewers', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/v1/me') return new Response(JSON.stringify({ user: { id: 'user-viewer', email: 'viewer@example.com' } }), { status: 200 });
      if (url === '/v1/collections') return new Response(JSON.stringify({ collections: [
        { id: 'coll_personal', kind: 'private', name: "Viewer's sessions", personalOwnerUserId: 'user-viewer', isMember: true, permissions: { canPublish: true, canInviteMembers: true, canRemoveMembers: true } },
        { id: 'coll_team', kind: 'private', name: 'Design team', personalOwnerUserId: null, isMember: true, permissions: { canPublish: false, canInviteMembers: false, canRemoveMembers: false } },
      ] }), { status: 200 });
      if (url === '/v1/flockdocs?collectionId=coll_personal' || url === '/v1/flockdocs?collectionId=coll_team') return new Response(JSON.stringify({ flockdocs: [] }), { status: 200 });
      if (url === '/v1/flockdoc-invitations') return new Response(JSON.stringify({ invitations: [] }), { status: 200 });
      throw new Error(`Unexpected request: GET ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    const navigation = await screen.findByRole('navigation', { name: 'Workspace navigation' });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Design team' }));
    expect(await screen.findByRole('heading', { name: 'Design team' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share workspace' })).not.toBeInTheDocument();
  });
});
