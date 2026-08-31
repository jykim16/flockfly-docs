import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlockdocApi, RevisionConflictError, consumeAuthTokenFromHash, getToken, setToken } from '../lib/api';

describe('Flockdoc API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores and consumes the platform bearer token from an OAuth hash', () => {
    setToken('existing');
    expect(getToken()).toBe('existing');
    expect(consumeAuthTokenFromHash('#/auth?token=remote-token')).toBe('remote-token');
    expect(getToken()).toBe('remote-token');
    setToken(null);
    expect(getToken()).toBeNull();
  });

  it('maps backend metadata and loads native snapshot state', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ flockdocs: [{
        id: 'flockdoc_1', type: 'spreadsheet', name: 'Plan', updatedAt: '2026-08-29T00:00:00Z',
        prefix: 'Planning/2027/',
        headRevision: 2, role: 'owner', permissions: { canRead: true, canEdit: true, canComment: true, canShare: true, canDelete: true },
      }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        revision: 2,
        snapshot: { id: 'flockdoc_1', sheets: {} },
        flockdoc: { id: 'flockdoc_1', type: 'spreadsheet', name: 'Plan', updatedAt: '2026-08-29T00:00:00Z', headRevision: 2, role: 'owner', permissions: { canRead: true, canEdit: true } },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const api = new FlockdocApi();
    const listed = await api.list();
    expect(listed.flockdocs[0]).toMatchObject({ id: 'flockdoc_1', prefix: 'Planning/2027/', modifiedAt: '2026-08-29T00:00:00Z', headRevision: 2 });
    const state = await api.getState('flockdoc_1');
    expect(state).toMatchObject({ revision: 2, snapshot: { id: 'flockdoc_1', sheets: {} } });
    expect(fetchMock.mock.calls[0][0]).toBe('/v1/flockdocs');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBeUndefined();
  });

  it('creates and moves files with path prefixes and soft-deletes files', async () => {
    const moved = { id: 'flockdoc_1', type: 'paper', name: 'Plan', prefix: 'Planning/2027/', updatedAt: '2026-08-30T00:00:00Z' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ flockdoc: moved }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ flockdoc: moved }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new FlockdocApi('token');

    await api.create('Plan', 'paper', 'Planning/2027/');
    await api.move('flockdoc_1', 'Planning/2027/');
    await api.trash('flockdoc_1');

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method, init.body ? JSON.parse(init.body) : null])).toEqual([
      ['/v1/flockdocs', 'POST', { name: 'Plan', type: 'paper', prefix: 'Planning/2027/' }],
      ['/v1/flockdocs/flockdoc_1', 'PATCH', { prefix: 'Planning/2027/' }],
      ['/v1/flockdocs/flockdoc_1', 'DELETE', null],
    ]);
  });

  it('saves against a base revision and exposes revision conflicts', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 3, snapshotKey: 'abc', duplicate: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'revision_conflict', message: 'newer', currentRevision: 4 } }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new FlockdocApi('token');

    await expect(api.saveState('flockdoc_1', 2, 'save-1', { id: 'flockdoc_1' })).resolves.toMatchObject({ revision: 3 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ baseRevision: 2, idempotencyKey: 'save-1' });
    await expect(api.saveState('flockdoc_1', 3, 'save-2', { id: 'flockdoc_1' }))
      .rejects.toEqual(expect.objectContaining<Partial<RevisionConflictError>>({ currentRevision: 4 }));
  });
});
