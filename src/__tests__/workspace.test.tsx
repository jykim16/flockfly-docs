import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

afterEach(() => vi.unstubAllGlobals());

describe('Flockdoc workspace', () => {
  it('uses the shared Flockfly platform shell and coastal branding', () => {
    render(<App />);
    const header = screen.getByRole('banner', { name: 'Flockfly platform navigation' });
    expect(within(header).getByRole('link', { name: 'Flockfly Platform' })).toHaveAttribute('href', 'https://platform.flockfly.ai/#/');
    const navigation = within(header).getByRole('navigation', { name: 'Platform' });
    expect(within(navigation).getAllByRole('link').map(link => link.textContent)).toEqual([
      'Skills', 'Routers', 'Sessions', 'Flockdoc', 'Getting started',
    ]);
    expect(within(navigation).getByRole('link', { name: 'Skills' })).toHaveAttribute('href', 'https://platform.flockfly.ai/#/skills');
    expect(within(navigation).getByRole('link', { name: 'Routers' })).toHaveAttribute('href', 'https://platform.flockfly.ai/#/routers');
    expect(within(navigation).getByRole('link', { name: 'Sessions' })).toHaveAttribute('href', 'https://platform.flockfly.ai/#/sessions');
    expect(within(navigation).getByRole('link', { name: 'Flockdoc' })).toHaveAttribute('href', '/flockdoc/');
    expect(within(navigation).getByRole('link', { name: 'Flockdoc' })).toHaveAttribute('aria-current', 'page');
    expect(within(navigation).getByRole('link', { name: 'Getting started' })).toHaveAttribute('href', 'https://platform.flockfly.ai/#/getting-started');
    expect(within(header).getByText('Preview workspace')).toBeInTheDocument();
  });

  it('uses the agreed Paper, Spreadsheet, and Flockdoc terminology', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'My workspace' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    const menu = screen.getByRole('menu', { name: 'Create' });
    expect(within(menu).getByRole('menuitem', { name: 'Paper' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Spreadsheet' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Folder' })).toBeInTheDocument();
  });

  it('starts without seeded documents or mock collaboration data', () => {
    render(<App />);
    const table = screen.getByRole('table', { name: 'Flockdocs' });
    expect(within(table).getAllByRole('row')).toHaveLength(1);
    expect(screen.getByText('No flockdocs yet')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Document details' })).not.toBeInTheDocument();
    expect(screen.getByText('Storage data unavailable')).toBeInTheDocument();
  });

  it('replaces browser state with the authenticated cloud workspace', async () => {
    localStorage.setItem('flockfly.flockdoc.workspace.v1', JSON.stringify({ version: 1, items: [{
      id: 'browser-only', name: 'Browser only', type: 'paper', modifiedAt: 'Just now', collaborators: [],
    }] }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        user: { id: 'user-1', email: 'planner@flockfly.ai' }, billing: { entitled: true },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ flockdocs: [{
        id: 'cloud-1', name: 'Cloud plan', type: 'spreadsheet', updatedAt: '2026-08-29T00:00:00Z',
        headRevision: 3, role: 'editor', permissions: { canRead: true, canComment: true, canEdit: true, canShare: false, canDelete: false },
      }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('Cloud plan')).toBeInTheDocument();
    expect(screen.queryByText('Browser only')).not.toBeInTheDocument();
    const account = screen.getByRole('link', { name: /planner@flockfly.ai/i });
    expect(account).toHaveAttribute('href', 'https://platform.flockfly.ai/#/account');
    expect(within(account).getByText('Pro')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('/v1/me');
  });
});
