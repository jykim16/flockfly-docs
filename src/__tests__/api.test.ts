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
        headRevision: 2, role: 'owner', permissions: { canRead: true, canEdit: true, canComment: true, canShare: true, canDelete: true },
      }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        revision: 2,
        snapshot: { id: 'flockdoc_1', sheets: {} },
        flockdoc: { id: 'flockdoc_1', type: 'spreadsheet', name: 'Plan', updatedAt: '2026-08-29T00:00:00Z', headRevision: 2, role: 'owner', permissions: { canRead: true, canEdit: true } },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const api = new FlockdocApi('token');
    const listed = await api.list();
    expect(listed.flockdocs[0]).toMatchObject({ id: 'flockdoc_1', modifiedAt: '2026-08-29T00:00:00Z', headRevision: 2 });
    const state = await api.getState('flockdoc_1');
    expect(state).toMatchObject({ revision: 2, snapshot: { id: 'flockdoc_1', sheets: {} } });
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer token');
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
