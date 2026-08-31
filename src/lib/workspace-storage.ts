import type { Flockdoc } from '../types';
import { normalizePrefix } from './prefixes';

export const WORKSPACE_STORAGE_KEY = 'flockfly.flockdoc.workspace.v1';
export const FOLDER_STORAGE_KEY = 'flockfly.flockdoc.folders.v1';

interface WorkspaceRecord {
  version: 1;
  flockdocs: Flockdoc[];
}

type LegacyFlockdoc = Omit<Flockdoc, 'prefix'> & { prefix?: string; parentFolderId?: string | null };
type LegacyFolder = { id: string; name: string; parentFolderId: string | null };

function isFlockdoc(value: unknown): value is LegacyFlockdoc {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Flockdoc>;
  return typeof item.id === 'string'
    && typeof item.name === 'string'
    && (item.type === 'paper' || item.type === 'spreadsheet')
    && typeof item.modifiedAt === 'string'
    && Array.isArray(item.collaborators);
}

function legacyFolderPath(storage: Storage, folderId: string): string {
  try {
    const record = JSON.parse(storage.getItem(FOLDER_STORAGE_KEY) ?? '{}') as { version?: number; folders?: LegacyFolder[] };
    if (record.version !== 1 || !Array.isArray(record.folders)) return '';
    const folders = new Map(record.folders.map(folder => [folder.id, folder]));
    const segments: string[] = [];
    const seen = new Set<string>();
    let id: string | null = folderId;
    while (id && !seen.has(id)) { seen.add(id); const folder = folders.get(id); if (!folder) return ''; segments.unshift(folder.name); id = folder.parentFolderId; }
    return normalizePrefix(segments.join('/'));
  } catch { return ''; }
}

export function loadWorkspace(storage: Storage): Flockdoc[] {
  try {
    const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return [];
    const record = JSON.parse(raw) as Partial<WorkspaceRecord>;
    if (record.version !== 1 || !Array.isArray(record.flockdocs) || !record.flockdocs.every(isFlockdoc)) return [];
    return record.flockdocs.map(item => {
      const legacy = item as LegacyFlockdoc;
      const prefix = typeof legacy.prefix === 'string' ? normalizePrefix(legacy.prefix) : legacy.parentFolderId ? legacyFolderPath(storage, legacy.parentFolderId) : '';
      const { parentFolderId: _retired, ...current } = legacy;
      return { ...current, prefix } as Flockdoc;
    });
  } catch {
    return [];
  }
}

export function saveWorkspace(flockdocs: Flockdoc[], storage: Storage): void {
  const record: WorkspaceRecord = { version: 1, flockdocs };
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(record));
  storage.removeItem(FOLDER_STORAGE_KEY);
}
