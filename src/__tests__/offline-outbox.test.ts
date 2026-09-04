import { describe, expect, it, vi } from 'vitest';
import type { FlockdocApi } from '../lib/api';
import { FlockdocOutbox } from '../lib/flockdoc-outbox';
import type { SpreadsheetOperation } from '../lib/spreadsheet-operations';

const cellOperation: SpreadsheetOperation = {
  protocolVersion: 1,
  kind: 'spreadsheet.cells.patch',
  sheetId: 'sheet-1',
  changes: [{ row: 2, column: 3, value: 'offline' }],
};

describe('authenticated flockdoc outbox', () => {
  it('retains failed writes durably and replays them with the same idempotency key', async () => {
    const api = {
      appendSpreadsheetOperation: vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ revision: 8, duplicate: false }),
    } as unknown as FlockdocApi;
    const outbox = new FlockdocOutbox(localStorage, 'user-a@flockfly.ai');
    const queued = outbox.enqueueSpreadsheet('flockdoc-1', 'browser-1', cellOperation);

    await expect(outbox.flush(api)).rejects.toThrow('Failed to fetch');
    expect(new FlockdocOutbox(localStorage, 'user-a@flockfly.ai').pending()).toHaveLength(1);
    await new FlockdocOutbox(localStorage, 'user-a@flockfly.ai').flush(api);

    expect(api.appendSpreadsheetOperation).toHaveBeenNthCalledWith(1, 'flockdoc-1', queued.idempotencyKey, 'browser-1', cellOperation);
    expect(api.appendSpreadsheetOperation).toHaveBeenNthCalledWith(2, 'flockdoc-1', queued.idempotencyKey, 'browser-1', cellOperation);
    expect(new FlockdocOutbox(localStorage, 'user-a@flockfly.ai').pending()).toEqual([]);
  });

  it('keeps account queues isolated', () => {
    new FlockdocOutbox(localStorage, 'user-a@flockfly.ai').enqueueSpreadsheet('flockdoc-1', 'browser-1', cellOperation);
    expect(new FlockdocOutbox(localStorage, 'user-b@flockfly.ai').pending()).toEqual([]);
  });

  it('replays paper updates through the same durable queue', async () => {
    const operation = { protocolVersion: 1 as const, kind: 'paper.yjs.update' as const, updateBase64: 'AQID' };
    const api = { appendPaperOperation: vi.fn().mockResolvedValue({ revision: 3, duplicate: false }) } as unknown as FlockdocApi;
    const outbox = new FlockdocOutbox(localStorage, 'user-a@flockfly.ai');
    const queued = outbox.enqueuePaper('paper-1', 'browser-1', operation);

    await outbox.flush(api);

    expect(api.appendPaperOperation).toHaveBeenCalledWith('paper-1', queued.idempotencyKey, 'browser-1', operation);
  });

  it('rebases queued structure changes and checkpoints onto the latest server revision', async () => {
    const structureOperation: SpreadsheetOperation = {
      protocolVersion: 1,
      kind: 'spreadsheet.structure.patch',
      baseRevision: 2,
      changes: [{ action: 'rows.insert', sheetId: 'sheet-1', index: 4, count: 1 }],
    };
    const api = {
      getState: vi.fn().mockResolvedValue({ revision: 7 }),
      appendSpreadsheetOperation: vi.fn().mockResolvedValue({ revision: 8, duplicate: false }),
      saveCheckpoint: vi.fn().mockResolvedValue({ revision: 9, duplicate: false, snapshotKey: 'snapshot-9' }),
    } as unknown as FlockdocApi;
    const outbox = new FlockdocOutbox(localStorage, 'user-a@flockfly.ai');
    outbox.enqueueSpreadsheet('flockdoc-1', 'browser-1', structureOperation);
    outbox.enqueueCheckpoint('flockdoc-1', 'browser-1', { id: 'flockdoc-1', sheets: {} });

    const revisions = await outbox.flush(api);

    expect(api.appendSpreadsheetOperation).toHaveBeenCalledWith('flockdoc-1', expect.any(String), 'browser-1', {
      ...structureOperation,
      baseRevision: 7,
    });
    expect(api.saveCheckpoint).toHaveBeenCalledWith('flockdoc-1', 8, expect.any(String), { id: 'flockdoc-1', sheets: {} }, 'browser-1');
    expect(revisions.get('flockdoc-1')).toBe(9);
  });

  it('coalesces unsent checkpoints while preserving operation order', () => {
    const outbox = new FlockdocOutbox(localStorage, 'user-a@flockfly.ai');
    outbox.enqueueCheckpoint('flockdoc-1', 'browser-1', { revision: 1 });
    outbox.enqueueSpreadsheet('flockdoc-1', 'browser-1', cellOperation);
    outbox.enqueueCheckpoint('flockdoc-1', 'browser-1', { revision: 2 });

    expect(outbox.pending().map(entry => entry.kind)).toEqual(['spreadsheet', 'checkpoint']);
    expect(outbox.pending()[1]).toMatchObject({ snapshot: { revision: 2 } });
  });

  it('does not discard a newer checkpoint queued while an older one is in flight', async () => {
    let releaseFirst!: (value: { revision: number; duplicate: boolean; snapshotKey: string }) => void;
    const firstSave = new Promise<{ revision: number; duplicate: boolean; snapshotKey: string }>(resolve => { releaseFirst = resolve; });
    const api = {
      getState: vi.fn().mockResolvedValue({ revision: 3 }),
      saveCheckpoint: vi.fn()
        .mockReturnValueOnce(firstSave)
        .mockResolvedValueOnce({ revision: 5, duplicate: false, snapshotKey: 'snapshot-5' }),
    } as unknown as FlockdocApi;
    const outbox = new FlockdocOutbox(localStorage, 'user-a@flockfly.ai');
    outbox.enqueueCheckpoint('flockdoc-1', 'browser-1', { revision: 1 });
    const flushing = outbox.flush(api);
    await vi.waitFor(() => expect(api.saveCheckpoint).toHaveBeenCalledTimes(1));

    outbox.enqueueCheckpoint('flockdoc-1', 'browser-1', { revision: 2 });
    releaseFirst({ revision: 4, duplicate: false, snapshotKey: 'snapshot-4' });
    await flushing;

    expect(api.saveCheckpoint).toHaveBeenCalledTimes(2);
    expect(api.saveCheckpoint).toHaveBeenLastCalledWith('flockdoc-1', 4, expect.any(String), { revision: 2 }, 'browser-1');
    expect(outbox.pending()).toEqual([]);
  });
});
