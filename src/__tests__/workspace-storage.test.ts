import { describe, expect, it } from 'vitest';
import type { Flockdoc } from '../types';
import { FOLDER_STORAGE_KEY, loadWorkspace, saveWorkspace, WORKSPACE_STORAGE_KEY } from '../lib/workspace-storage';

const paper: Flockdoc = {
  id: 'paper-1',
  name: 'Persistent plan',
  type: 'paper',
  prefix: '',
  modifiedAt: 'Just now',
  collaborators: [],
  snapshot: { id: 'paper-1', body: { dataStream: 'Hello\r\n' } },
};

describe('workspace storage', () => {
  it('loads an empty workspace when no record exists', () => {
    expect(loadWorkspace(localStorage)).toEqual([]);
  });

  it('round-trips flockdoc metadata and Univer snapshots', () => {
    saveWorkspace([paper], localStorage);

    expect(loadWorkspace(localStorage)).toEqual([paper]);
    expect(JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY)!)).toMatchObject({ version: 1 });
  });

  it('migrates legacy nested folder IDs to prefixes and clears folder storage on save', () => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ version: 1, flockdocs: [{ ...paper, prefix: undefined, parentFolderId: 'folder-child' }] }));
    localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify({ version: 1, folders: [
      { id: 'folder-parent', name: 'Planning', parentFolderId: null, modifiedAt: 'Just now' },
      { id: 'folder-child', name: '2027', parentFolderId: 'folder-parent', modifiedAt: 'Just now' },
    ] }));

    const migrated = loadWorkspace(localStorage);
    expect(migrated[0]).toMatchObject({ id: paper.id, prefix: 'Planning/2027/' });
    expect(migrated[0]).not.toHaveProperty('parentFolderId');
    saveWorkspace(migrated, localStorage);
    expect(localStorage.getItem(FOLDER_STORAGE_KEY)).toBeNull();
  });

  it.each([
    '{',
    JSON.stringify({ version: 2, flockdocs: [paper] }),
    JSON.stringify({ version: 1, flockdocs: 'not-an-array' }),
  ])('fails safely for invalid or unsupported records', (value) => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, value);
    expect(loadWorkspace(localStorage)).toEqual([]);
  });
});
