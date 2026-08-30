import type { Flockdoc } from '../types';

export const WORKSPACE_STORAGE_KEY = 'flockfly.flockdoc.workspace.v1';

interface WorkspaceRecord {
  version: 1;
  flockdocs: Flockdoc[];
}

function isFlockdoc(value: unknown): value is Flockdoc {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Flockdoc>;
  return typeof item.id === 'string'
    && typeof item.name === 'string'
    && (item.type === 'paper' || item.type === 'spreadsheet')
    && typeof item.modifiedAt === 'string'
    && Array.isArray(item.collaborators);
}

export function loadWorkspace(storage: Storage): Flockdoc[] {
  try {
    const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return [];
    const record = JSON.parse(raw) as Partial<WorkspaceRecord>;
    if (record.version !== 1 || !Array.isArray(record.flockdocs) || !record.flockdocs.every(isFlockdoc)) return [];
    return record.flockdocs;
  } catch {
    return [];
  }
}

export function saveWorkspace(flockdocs: Flockdoc[], storage: Storage): void {
  const record: WorkspaceRecord = { version: 1, flockdocs };
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(record));
}
