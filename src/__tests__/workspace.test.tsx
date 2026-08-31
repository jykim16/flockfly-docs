import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

afterEach(() => vi.unstubAllGlobals());

describe('Flockdoc workspace', () => {
  it('uses the shared Flockfly platform shell and coastal branding', () => {
    render(<App />);
    const header = screen.getByRole('banner', { name: 'Flockfly platform navigation' });
    expect(within(header).getByRole('link', { name: 'Flockfly Platform' })).toHaveAttribute('href', 'https://platform.flockfly.ai/');
    const navigation = within(header).getByRole('navigation', { name: 'Platform' });
    expect(within(navigation).getAllByRole('link').map(link => link.textContent)).toEqual([
      'Skills', 'Routers', 'Sessions', 'Flockdoc', 'Getting started',
    ]);
    expect(within(navigation).getByRole('link', { name: 'Skills' })).toHaveAttribute('href', 'https://platform.flockfly.ai/skills');
    expect(within(navigation).getByRole('link', { name: 'Routers' })).toHaveAttribute('href', 'https://platform.flockfly.ai/routers');
    expect(within(navigation).getByRole('link', { name: 'Sessions' })).toHaveAttribute('href', 'https://platform.flockfly.ai/sessions');
    expect(within(navigation).getByRole('link', { name: 'Flockdoc' })).toHaveAttribute('href', '/flockdoc/');
    expect(within(navigation).getByRole('link', { name: 'Flockdoc' })).toHaveAttribute('aria-current', 'page');
    expect(within(navigation).getByRole('link', { name: 'Getting started' })).toHaveAttribute('href', 'https://platform.flockfly.ai/getting-started');
    expect(within(header).getByText('Preview workspace')).toBeInTheDocument();
  });

  it('shows only implemented workspace navigation and actions', () => {
    localStorage.setItem('flockfly.flockdoc.workspace.v1', JSON.stringify({ version: 1, flockdocs: [{
      id: 'paper-1', name: 'Planning Paper', type: 'paper', modifiedAt: 'Just now', collaborators: [], starred: true,
    }] }));
    render(<App />);

    const navigation = screen.getByRole('navigation', { name: 'Workspace navigation' });
    const workspaceLink = within(navigation).getByRole('link', { name: 'My workspace' });
    expect(workspaceLink).toHaveAttribute('href', '/flockdoc/');
    expect(workspaceLink).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Storage')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();

    const row = screen.getByRole('row', { name: /Planning Paper/ });
    expect(row.querySelectorAll('.file-name svg')).toHaveLength(1);
    fireEvent.click(row);
    expect(screen.queryByRole('complementary', { name: 'Document details' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Add a comment')).not.toBeInTheDocument();
  });

  it('opens flockdocs from a single accessible click with a clean path', () => {
    localStorage.setItem('flockfly.flockdoc.workspace.v1', JSON.stringify({ version: 1, flockdocs: [{
      id: 'paper-1', name: 'Planning Paper', type: 'paper', modifiedAt: 'Just now', collaborators: [],
    }] }));
    render(<App />);

    fireEvent.click(screen.getByRole('row', { name: /Planning Paper/ }));

    expect(window.location.pathname).toBe('/flockdoc/paper/paper-1');
    expect(window.location.hash).toBe('');
    expect(screen.getByLabelText('Paper editor')).toBeInTheDocument();
  });

  it('uses the agreed Paper, Spreadsheet, and Flockdoc terminology', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'My workspace' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    const menu = screen.getByRole('menu', { name: 'Create' });
    expect(within(menu).getByRole('menuitem', { name: 'Paper' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Spreadsheet' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Folder' })).not.toBeInTheDocument();
  });

  it('derives and browses virtual folders from flockdoc prefixes', () => {
    localStorage.setItem('flockfly.flockdoc.workspace.v1', JSON.stringify({ version: 1, flockdocs: [{
      id: 'paper-1', name: 'Planning Paper', type: 'paper', modifiedAt: 'Just now', prefix: 'Planning/2027/', collaborators: [],
    }] }));
    render(<App />);

    const folderRow = screen.getByRole('row', { name: /Planning Folder/ });
    fireEvent.click(within(folderRow).getByRole('button', { name: 'Open Planning' }));
    const breadcrumb = screen.getByRole('navigation', { name: 'Folder path' });
    expect(within(breadcrumb).getByRole('button', { name: 'My workspace' })).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Planning')).toBeInTheDocument();
  });

  it('creates a new flockdoc under the currently browsed prefix', () => {
    localStorage.setItem('flockfly.flockdoc.workspace.v1', JSON.stringify({ version: 1, flockdocs: [{
      id: 'existing', name: 'Existing', type: 'paper', modifiedAt: 'Just now', prefix: 'Planning/', collaborators: [],
    }] }));
    render(<App />);
    fireEvent.click(within(screen.getByRole('row', { name: /Planning Folder/ })).getByRole('button', { name: 'Open Planning' }));
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Paper' }));

    expect(screen.getByLabelText('Paper editor')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('flockfly.flockdoc.workspace.v1')!).flockdocs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Untitled Paper', prefix: 'Planning/' }),
    ]));
  });

  it('moves a local file to a new path prefix and deletes it after confirmation', () => {
    localStorage.setItem('flockfly.flockdoc.workspace.v1', JSON.stringify({ version: 1, flockdocs: [{
      id: 'paper-1', name: 'Planning Paper', type: 'paper', modifiedAt: 'Just now', prefix: '', collaborators: [],
    }] }));
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Move Planning Paper' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Move Planning Paper to folder path' }), { target: { value: 'Planning/2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm move' }));
    expect(screen.queryByRole('row', { name: /Planning Paper/ })).not.toBeInTheDocument();

    const folderRow = screen.getByRole('row', { name: /Planning Folder/ });
    fireEvent.click(within(folderRow).getByRole('button', { name: 'Open Planning' }));
    fireEvent.click(within(screen.getByRole('row', { name: /2027 Folder/ })).getByRole('button', { name: 'Open 2027' }));
    expect(screen.getByRole('row', { name: /Planning Paper/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Planning Paper' }));
    expect(screen.getByText('Delete “Planning Paper”?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(screen.queryByRole('row', { name: /Planning Paper/ })).not.toBeInTheDocument();
  });

  it('hides move and delete when backend permissions do not allow them', () => {
    localStorage.setItem('flockfly.flockdoc.workspace.v1', JSON.stringify({ version: 1, flockdocs: [{
      id: 'paper-1', name: 'Read-only Paper', type: 'paper', modifiedAt: 'Just now', prefix: '', collaborators: [],
      permissions: { canRead: true, canComment: false, canEdit: false, canShare: false, canDelete: false },
    }] }));
    render(<App />);

    expect(screen.queryByRole('button', { name: 'Move Read-only Paper' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Read-only Paper' })).not.toBeInTheDocument();
  });

  it('starts without seeded documents or mock collaboration data', () => {
    render(<App />);
    const table = screen.getByRole('table', { name: 'Flockdocs' });
    expect(within(table).getAllByRole('row')).toHaveLength(1);
    expect(screen.getByText('No flockdocs yet')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Document details' })).not.toBeInTheDocument();
    expect(screen.queryByText('Storage data unavailable')).not.toBeInTheDocument();
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
        headRevision: 3, role: 'manager', permissions: { canRead: true, canComment: true, canEdit: true, canShare: true, canDelete: false },
      }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ invitations: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('Cloud plan')).toBeInTheDocument();
    expect(screen.queryByText('Browser only')).not.toBeInTheDocument();
    const account = screen.getByRole('link', { name: /planner@flockfly.ai/i });
    expect(account).toHaveAttribute('href', 'https://platform.flockfly.ai/account');
    expect(within(account).getByText('Pro')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('/v1/me');
  });
});
