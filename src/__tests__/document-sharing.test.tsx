import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentShareDialog } from '../features/sharing/DocumentShareDialog';
import type { FlockdocApi } from '../lib/api';

function apiMock() {
  return {
    listAccess: vi.fn().mockResolvedValue({ grants: [
      { principalType: 'user', principalId: 'user_2', email: 'alex@example.com', username: 'Alex', role: 'editor', status: 'active' },
      { principalType: 'agent', principalId: 'agent_research', role: 'viewer' },
    ] }),
    grantUserRole: vi.fn().mockResolvedValue(undefined),
    grantRole: vi.fn().mockResolvedValue(undefined),
    removeAccess: vi.fn().mockResolvedValue(undefined),
    listShareLinks: vi.fn().mockResolvedValue({ shareLinks: [] }),
    createShareLink: vi.fn().mockResolvedValue({ shareLink: { id: 'link_1', role: 'viewer', token: 'secret-token', revokedAt: null, expiresAt: null, createdAt: '2026-08-30T00:00:00Z' } }),
    revokeShareLink: vi.fn().mockResolvedValue(undefined),
  };
}

describe('document sharing', () => {
  it('loads collaborators and lets a manager add a teammate by email', async () => {
    const api = apiMock();
    render(<DocumentShareDialog api={api as unknown as FlockdocApi} flockdocId="flockdoc_1" name="Launch plan" onClose={() => {}} />);

    expect(await screen.findByRole('dialog', { name: 'Share Launch plan' })).toBeInTheDocument();
    expect(await screen.findByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('agent_research')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email or agent ID'), { target: { value: 'teammate@example.com' } });
    fireEvent.change(screen.getByLabelText('Access role'), { target: { value: 'editor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add collaborator' }));
    await waitFor(() => expect(api.grantUserRole).toHaveBeenCalledWith('flockdoc_1', 'teammate@example.com', 'editor'));
  });

  it('changes and removes collaborator access', async () => {
    const api = apiMock();
    render(<DocumentShareDialog api={api as unknown as FlockdocApi} flockdocId="flockdoc_1" name="Launch plan" onClose={() => {}} />);
    const row = await screen.findByRole('listitem', { name: /alex@example.com/i });

    fireEvent.change(within(row).getByLabelText('Role for alex@example.com'), { target: { value: 'viewer' } });
    await waitFor(() => expect(api.grantRole).toHaveBeenCalledWith('flockdoc_1', 'user', 'user_2', 'viewer'));
    fireEvent.click(within(row).getByRole('button', { name: 'Remove alex@example.com' }));
    await waitFor(() => expect(api.removeAccess).toHaveBeenCalledWith('flockdoc_1', 'user', 'user_2'));
  });

  it('creates a recipient invite link and copies the document URL', async () => {
    const api = apiMock();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<DocumentShareDialog api={api as unknown as FlockdocApi} flockdocId="flockdoc_1" name="Launch plan" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create and copy invite link' }));
    await waitFor(() => expect(api.createShareLink).toHaveBeenCalledWith('flockdoc_1', 'viewer'));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/flockdoc\/paper\/flockdoc_1\?share=secret-token$/));
    expect(screen.getByText('Invite link copied')).toBeInTheDocument();
  });
});
