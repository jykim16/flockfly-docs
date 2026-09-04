import type { FlockdocApi } from './api';
import type { PaperYjsOperation } from './paper-collaboration';
import type { SpreadsheetOperation } from './spreadsheet-operations';

type OutboxBase = {
  id: string;
  flockdocId: string;
  clientId: string;
  idempotencyKey: string;
};

export type FlockdocOutboxEntry = OutboxBase & (
  | { kind: 'spreadsheet'; operation: SpreadsheetOperation }
  | { kind: 'paper'; operation: PaperYjsOperation }
  | { kind: 'checkpoint'; snapshot: unknown }
  | { kind: 'rename'; name: string }
);

type NewOutboxEntry = FlockdocOutboxEntry extends infer Entry
  ? Entry extends FlockdocOutboxEntry ? Omit<Entry, 'id' | 'idempotencyKey'> : never
  : never;

type OutboxRecord = { version: 1; entries: FlockdocOutboxEntry[] };

function storageKey(accountId: string): string {
  return `flockfly.flockdoc.outbox.v1:${encodeURIComponent(accountId.toLowerCase())}`;
}

function loadEntries(storage: Storage, key: string): FlockdocOutboxEntry[] {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? '{}') as Partial<OutboxRecord>;
    return parsed.version === 1 && Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

export class FlockdocOutbox {
  private entries: FlockdocOutboxEntry[];
  private flushing?: Promise<Map<string, number>>;
  private readonly key: string;

  constructor(private readonly storage: Storage, accountId: string) {
    this.key = storageKey(accountId);
    this.entries = loadEntries(storage, this.key);
  }

  pending(): FlockdocOutboxEntry[] {
    return structuredClone(this.entries);
  }

  enqueueSpreadsheet(flockdocId: string, clientId: string, operation: SpreadsheetOperation) {
    return this.enqueue({ kind: 'spreadsheet', flockdocId, clientId, operation });
  }

  enqueuePaper(flockdocId: string, clientId: string, operation: PaperYjsOperation) {
    return this.enqueue({ kind: 'paper', flockdocId, clientId, operation });
  }

  enqueueCheckpoint(flockdocId: string, clientId: string, snapshot: unknown) {
    this.entries = this.entries.filter(entry => entry.flockdocId !== flockdocId || entry.kind !== 'checkpoint');
    return this.enqueue({ kind: 'checkpoint', flockdocId, clientId, snapshot });
  }

  enqueueRename(flockdocId: string, clientId: string, name: string) {
    this.entries = this.entries.filter(entry => entry.flockdocId !== flockdocId || entry.kind !== 'rename');
    return this.enqueue({ kind: 'rename', flockdocId, clientId, name });
  }

  flush(api: FlockdocApi): Promise<Map<string, number>> {
    if (this.flushing) return this.flushing;
    const operation = this.flushEntries(api).finally(() => {
      if (this.flushing === operation) this.flushing = undefined;
    });
    this.flushing = operation;
    return operation;
  }

  private enqueue(value: NewOutboxEntry): FlockdocOutboxEntry {
    const entry = { ...value, id: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() } as FlockdocOutboxEntry;
    this.entries.push(entry);
    this.persist();
    return entry;
  }

  private persist(): void {
    if (this.entries.length) this.storage.setItem(this.key, JSON.stringify({ version: 1, entries: this.entries } satisfies OutboxRecord));
    else this.storage.removeItem(this.key);
  }

  private async flushEntries(api: FlockdocApi): Promise<Map<string, number>> {
    const revisions = new Map<string, number>();
    while (this.entries.length) {
      const entry = this.entries[0];
      let revision = revisions.get(entry.flockdocId);
      if ((entry.kind === 'checkpoint' || entry.kind === 'spreadsheet' && entry.operation.kind === 'spreadsheet.structure.patch') && revision === undefined) {
        revision = (await api.getState(entry.flockdocId)).revision;
        revisions.set(entry.flockdocId, revision);
      }

      if (entry.kind === 'spreadsheet') {
        const operation = entry.operation.kind === 'spreadsheet.structure.patch'
          ? { ...entry.operation, baseRevision: revision! }
          : entry.operation;
        const result = await api.appendSpreadsheetOperation(entry.flockdocId, entry.idempotencyKey, entry.clientId, operation);
        revisions.set(entry.flockdocId, result.revision);
      } else if (entry.kind === 'paper') {
        const result = await api.appendPaperOperation(entry.flockdocId, entry.idempotencyKey, entry.clientId, entry.operation);
        revisions.set(entry.flockdocId, result.revision);
      } else if (entry.kind === 'checkpoint') {
        const result = await api.saveCheckpoint(entry.flockdocId, revision!, entry.idempotencyKey, entry.snapshot, entry.clientId);
        revisions.set(entry.flockdocId, result.revision);
      } else {
        await api.rename(entry.flockdocId, entry.name);
      }

      this.entries = this.entries.filter(candidate => candidate.id !== entry.id);
      this.persist();
    }
    return revisions;
  }
}
