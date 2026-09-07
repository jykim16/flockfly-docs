import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

afterEach(() => {
  document.modelContext = undefined;
  vi.unstubAllGlobals();
});

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

  it('opens a listed flockdoc through WebMCP and rejects unknown ids', async () => {
    history.replaceState(null, '', '/flockdoc/');
    localStorage.setItem('flockfly.flockdoc.workspace.v1', JSON.stringify({ version: 1, flockdocs: [{
      id: 'sheet-1', name: 'Forecast', type: 'spreadsheet', modifiedAt: 'Just now', collaborators: [],
    }] }));
    const tools = new Map<string, { execute: (input: Record<string, unknown>) => unknown }>();
    document.modelContext = { registerTool: tool => { tools.set(tool.name, tool); } };
    render(<App />);
    await waitFor(() => expect(tools.has('flockdoc.open')).toBe(true));

    await act(async () => {
      await tools.get('flockdoc.open')?.execute({ id: 'sheet-1' });
    });
    expect(window.location.pathname).toBe('/flockdoc/spreadsheet/sheet-1');

    await expect(Promise.resolve().then(() => tools.get('flockdoc.open')?.execute({ id: 'missing' })))
      .rejects.toThrow('Flockdoc "missing" is not available in this workspace.');
    expect(window.location.pathname).toBe('/flockdoc/spreadsheet/sheet-1');
  });

  it('uses the agreed Paper, Spreadsheet, Diagram, Web App, and Flockdoc terminology', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'My workspace' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    const menu = screen.getByRole('menu', { name: 'Create' });
    expect(within(menu).getByRole('menuitem', { name: 'Paper' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Spreadsheet' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Diagram' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Web App' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Folder' })).not.toBeInTheDocument();
  });

  it('lets a signed-out user create a local Web App', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Web App' }));

    expect(window.location.pathname).toMatch(/^\/flockdoc\/webapp\//);
    expect(screen.getByTitle('Web App preview')).toBeInTheDocument();
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('flockfly.flockdoc.workspace.v1')!).flockdocs)
      .toEqual([expect.objectContaining({ name: 'Untitled Web App', type: 'webapp' })]);
  });

  it('lets a signed-out user create a local Diagram', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Diagram' }));

    expect(window.location.pathname).toMatch(/^\/flockdoc\/diagram\//);
    expect(screen.getByLabelText('Diagram editor')).toBeInTheDocument();
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('flockfly.flockdoc.workspace.v1')!).flockdocs)
      .toEqual([expect.objectContaining({ name: 'Untitled Diagram', type: 'diagram' })]);
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

  it('lets a signed-out user create a local Spreadsheet', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Spreadsheet' }));

    expect(window.location.pathname).toMatch(/^\/flockdoc\/spreadsheet\//);
    expect(screen.getByLabelText('Spreadsheet editor')).toBeInTheDocument();
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('flockfly.flockdoc.workspace.v1')!).flockdocs)
      .toEqual([expect.objectContaining({ name: 'Untitled Spreadsheet', type: 'spreadsheet' })]);
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

  it('migrates browser documents into the authenticated cloud workspace', async () => {
    localStorage.setItem('flockfly.flockdoc.workspace.v1', JSON.stringify({ version: 1, flockdocs: [{
      id: 'browser-only', name: 'Browser only', type: 'paper', prefix: '', modifiedAt: 'Just now', collaborators: [],
      snapshot: { id: 'browser-only', body: { dataStream: 'Draft\r\n' } },
    }] }));
    const cloudPermissions = { canRead: true, canComment: true, canEdit: true, canShare: true, canDelete: false };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/v1/me') return new Response(JSON.stringify({
        user: { id: 'user-1', email: 'planner@flockfly.ai' }, billing: { entitled: true },
      }), { status: 200 });
      if (url === '/v1/flockdocs' && init?.method === 'POST') return new Response(JSON.stringify({ flockdoc: {
        id: 'cloud-browser', name: 'Browser only', type: 'paper', updatedAt: '2026-09-03T00:00:00Z', headRevision: 0,
        role: 'owner', permissions: cloudPermissions,
      } }), { status: 200 });
      if (url === '/v1/flockdocs/cloud-browser/state') return new Response(JSON.stringify({
        flockdoc: { id: 'cloud-browser', name: 'Browser only', type: 'paper' }, revision: 0, snapshotRevision: 0, snapshot: null,
      }), { status: 200 });
      if (url === '/v1/flockdocs/cloud-browser/checkpoints') return new Response(JSON.stringify({ revision: 1, snapshotKey: 'snapshot-1', duplicate: false }), { status: 200 });
      if (url === '/v1/flockdocs') return new Response(JSON.stringify({ flockdocs: [{
        id: 'cloud-1', name: 'Cloud plan', type: 'spreadsheet', updatedAt: '2026-08-29T00:00:00Z',
        headRevision: 3, role: 'manager', permissions: cloudPermissions,
      }, {
        id: 'cloud-browser', name: 'Browser only', type: 'paper', updatedAt: '2026-09-03T00:00:00Z',
        headRevision: 1, role: 'owner', permissions: cloudPermissions,
      }] }), { status: 200 });
      if (url === '/v1/flockdoc-invitations') return new Response(JSON.stringify({ invitations: [] }), { status: 200 });
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('Cloud plan')).toBeInTheDocument();
    expect(screen.getByText('Browser only')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('flockfly.flockdoc.workspace.v1')!).flockdocs).toEqual([]);
    const checkpointCall = fetchMock.mock.calls.find(([url]) => url === '/v1/flockdocs/cloud-browser/checkpoints');
    expect(JSON.parse(String(checkpointCall?.[1]?.body))).toMatchObject({ snapshot: { id: 'cloud-browser', body: { dataStream: 'Draft\r\n' } } });
    const account = screen.getByRole('link', { name: /planner@flockfly.ai/i });
    expect(account).toHaveAttribute('href', 'https://platform.flockfly.ai/account');
    expect(within(account).getByText('Pro')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('/v1/me');
  });
});
