import type { FlockdocApi } from './api';
import { loadWorkspace, saveWorkspace } from './workspace-storage';

type MigrationEntry = {
  cloudId: string;
  checkpointIdempotencyKey: string;
};

type MigrationRecord = {
  version: 1;
  entries: Record<string, MigrationEntry>;
};

function migrationKey(accountId: string): string {
  return `flockfly.flockdoc.anonymous-migration.v1:${encodeURIComponent(accountId.toLowerCase())}`;
}

function loadRecord(storage: Storage, accountId: string): MigrationRecord {
  try {
    const parsed = JSON.parse(storage.getItem(migrationKey(accountId)) ?? '{}') as Partial<MigrationRecord>;
    if (parsed.version === 1 && parsed.entries && typeof parsed.entries === 'object') {
      return { version: 1, entries: parsed.entries };
    }
  } catch { /* Start a new resumable migration record. */ }
  return { version: 1, entries: {} };
}

function saveRecord(storage: Storage, accountId: string, record: MigrationRecord): void {
  const key = migrationKey(accountId);
  if (Object.keys(record.entries).length) storage.setItem(key, JSON.stringify(record));
  else storage.removeItem(key);
}

export async function migrateAnonymousWorkspace(api: FlockdocApi, storage: Storage, accountId: string): Promise<void> {
  const stored = loadWorkspace(storage);
  let remaining = stored.filter(item => !item.role && !item.permissions);
  if (remaining.length !== stored.length) saveWorkspace(remaining, storage);
  const record = loadRecord(storage, accountId);
  for (const local of [...remaining]) {
    let migration = record.entries[local.id];
    if (!migration) {
      const created = await api.create(local.name, local.type, local.prefix);
      migration = {
        cloudId: created.flockdoc.id,
        checkpointIdempotencyKey: crypto.randomUUID(),
      };
      record.entries[local.id] = migration;
      saveRecord(storage, accountId, record);
    }

    if (local.snapshot !== undefined) {
      const state = await api.getState(migration.cloudId);
      const snapshot = local.snapshot && typeof local.snapshot === 'object' && !Array.isArray(local.snapshot)
        ? { ...local.snapshot, id: migration.cloudId }
        : local.snapshot;
      await api.saveCheckpoint(
        migration.cloudId,
        state.revision,
        migration.checkpointIdempotencyKey,
        snapshot,
      );
    }

    remaining = remaining.filter(item => item.id !== local.id);
    saveWorkspace(remaining, storage);
    delete record.entries[local.id];
    saveRecord(storage, accountId, record);
  }
}
