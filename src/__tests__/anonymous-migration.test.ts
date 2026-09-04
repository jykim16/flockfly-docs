import { describe, expect, it, vi } from 'vitest';
import type { FlockdocApi } from '../lib/api';
import { migrateAnonymousWorkspace } from '../lib/anonymous-migration';
import { loadWorkspace, saveWorkspace } from '../lib/workspace-storage';
import type { Flockdoc } from '../types';

const localSheet: Flockdoc = {
  id: 'local-sheet',
  name: 'Offline forecast',
  type: 'spreadsheet',
  prefix: 'Planning/',
  modifiedAt: 'Just now',
  collaborators: [],
  snapshot: { id: 'local-sheet', sheets: { sheet1: { name: 'Sheet1' } } },
};

describe('anonymous workspace migration', () => {
  it('creates cloud documents, uploads their snapshots, and removes migrated local copies', async () => {
    saveWorkspace([localSheet], localStorage);
    const api = {
      create: vi.fn().mockResolvedValue({ flockdoc: { ...localSheet, id: 'cloud-sheet', headRevision: 0 } }),
      getState: vi.fn().mockResolvedValue({ revision: 0 }),
      saveCheckpoint: vi.fn().mockResolvedValue({ revision: 1, duplicate: false, snapshotKey: 'snapshot-1' }),
    } as unknown as FlockdocApi;

    await migrateAnonymousWorkspace(api, localStorage, 'new-user@flockfly.ai');

    expect(api.create).toHaveBeenCalledWith('Offline forecast', 'spreadsheet', 'Planning/');
    expect(api.saveCheckpoint).toHaveBeenCalledWith(
      'cloud-sheet',
      0,
      expect.any(String),
      { id: 'cloud-sheet', sheets: { sheet1: { name: 'Sheet1' } } },
    );
    expect(loadWorkspace(localStorage)).toEqual([]);
  });

  it('resumes an interrupted upload without creating a duplicate cloud document', async () => {
    saveWorkspace([localSheet], localStorage);
    const api = {
      create: vi.fn().mockResolvedValue({ flockdoc: { ...localSheet, id: 'cloud-sheet', headRevision: 0 } }),
      getState: vi.fn().mockResolvedValue({ revision: 0 }),
      saveCheckpoint: vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ revision: 1, duplicate: false, snapshotKey: 'snapshot-1' }),
    } as unknown as FlockdocApi;

    await expect(migrateAnonymousWorkspace(api, localStorage, 'existing-user@flockfly.ai')).rejects.toThrow('Failed to fetch');
    await migrateAnonymousWorkspace(api, localStorage, 'existing-user@flockfly.ai');

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.saveCheckpoint).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.saveCheckpoint).mock.calls[0][2]).toBe(vi.mocked(api.saveCheckpoint).mock.calls[1][2]);
    expect(loadWorkspace(localStorage)).toEqual([]);
  });

  it('does not duplicate cloud documents cached by an older app version', async () => {
    const cachedCloud = {
      ...localSheet,
      id: 'existing-cloud',
      role: 'owner' as const,
      permissions: { canRead: true, canComment: true, canEdit: true, canShare: true, canDelete: true },
    };
    saveWorkspace([cachedCloud], localStorage);
    const api = { create: vi.fn() } as unknown as FlockdocApi;

    await migrateAnonymousWorkspace(api, localStorage, 'user@flockfly.ai');

    expect(api.create).not.toHaveBeenCalled();
    expect(loadWorkspace(localStorage)).toEqual([]);
  });
});
