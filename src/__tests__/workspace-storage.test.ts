import { describe, expect, it } from 'vitest';
import type { Flockdoc, FlockdocFolder } from '../types';
import { FOLDER_STORAGE_KEY, loadFolders, loadWorkspace, saveFolders, saveWorkspace, WORKSPACE_STORAGE_KEY } from '../lib/workspace-storage';

const paper: Flockdoc = {
  id: 'paper-1',
  name: 'Persistent plan',
  type: 'paper',
  modifiedAt: 'Just now',
  collaborators: [],
  snapshot: { id: 'paper-1', body: { dataStream: 'Hello\r\n' } },
};

const folder: FlockdocFolder = {
  id: 'folder-1',
  name: 'Planning',
  parentFolderId: null,
  modifiedAt: 'Just now',
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

  it('round-trips local folders independently of legacy flockdoc storage', () => {
    saveWorkspace([paper], localStorage);
    saveFolders([folder], localStorage);

    expect(loadFolders(localStorage)).toEqual([folder]);
    expect(loadWorkspace(localStorage)).toEqual([paper]);
    expect(JSON.parse(localStorage.getItem(FOLDER_STORAGE_KEY)!)).toMatchObject({ version: 1 });
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
