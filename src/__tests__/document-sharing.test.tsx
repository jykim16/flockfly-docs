import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentShareDialog } from '../features/sharing/DocumentShareDialog';
import type { FlockdocApi } from '../lib/api';

function apiMock() {
  return {
    listMembers: vi.fn().mockResolvedValue({ flockdoc: { visibility: 'private', permissions: { canShare: true, canDelete: true } }, members: [
      { email: 'owner@example.com', username: 'Owner', role: 'owner', status: 'active' },
      { email: 'alex@example.com', username: 'Alex', role: 'manager', status: 'active' },
    ], invitations: [{ id: 'finv_1', email: 'pending@example.com', role: 'commenter' }] }),
    inviteMember: vi.fn().mockResolvedValue({ invitation: { id: 'finv_2', email: 'new@example.com', role: 'commenter' } }),
    changeMemberRole: vi.fn().mockResolvedValue({ member: { email: 'alex@example.com', role: 'viewer' } }),
    removeMember: vi.fn().mockResolvedValue(undefined),
    setVisibility: vi.fn().mockResolvedValue({ flockdoc: { visibility: 'public' } }),
  };
}

describe('document sharing', () => {
  it('matches the Router sharing roles and invitation structure', async () => {
    const api = apiMock();
    render(<DocumentShareDialog api={api as unknown as FlockdocApi} flockdocId="flockdoc_1" flockdocType="paper" name="Launch plan" currentUserEmail="owner@example.com" onClose={() => {}} />);
    expect(await screen.findByRole('dialog', { name: 'Share “Launch plan”' })).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Can manage' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Can comment' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Can view' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Editor')).not.toBeInTheDocument();
    expect(await screen.findByText('pending@example.com')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Invite by email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Invite role'), { target: { value: 'commenter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    await waitFor(() => expect(api.inviteMember).toHaveBeenCalledWith('flockdoc_1', 'new@example.com', 'commenter'));
  });

  it('uses the Router role menu and general access controls', async () => {
    const api = apiMock();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<DocumentShareDialog api={api as unknown as FlockdocApi} flockdocId="flockdoc_1" flockdocType="paper" name="Launch plan" currentUserEmail="owner@example.com" onClose={() => {}} />);
    const alex = await screen.findByRole('listitem', { name: /alex@example.com/i });
    fireEvent.click(within(alex).getByRole('button', { name: 'Manage access for alex@example.com' }));
    fireEvent.click(within(alex).getByRole('button', { name: 'Can view' }));
    await waitFor(() => expect(api.changeMemberRole).toHaveBeenCalledWith('flockdoc_1', 'alex@example.com', 'viewer'));
    fireEvent.click(screen.getByLabelText('Public'));
    await waitFor(() => expect(api.setVisibility).toHaveBeenCalledWith('flockdoc_1', 'public'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/flockdoc\/paper\/flockdoc_1$/));
  });
});
