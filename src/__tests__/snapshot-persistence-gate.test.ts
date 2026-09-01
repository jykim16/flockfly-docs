import { describe, expect, it, vi } from 'vitest';
import { SnapshotPersistenceGate } from '../lib/snapshot-persistence-gate';

describe('snapshot persistence gate', () => {
  it('does not persist the authoritative snapshot emitted during editor initialization', async () => {
    const gate = new SnapshotPersistenceGate({ id: 'sheet-1', cellData: { 0: { 0: { v: 'Plan' } } } });
    const persist = vi.fn();

    await expect(gate.persistIfChanged(
      { id: 'sheet-1', cellData: { 0: { 0: { v: 'Plan' } } } },
      persist,
    )).resolves.toEqual({ changed: false });
    expect(persist).not.toHaveBeenCalled();
  });

  it('persists a local content change and accepts it as the next baseline', async () => {
    const gate = new SnapshotPersistenceGate({ body: { dataStream: 'Plan\r\n' } });
    const changed = { body: { dataStream: 'Updated plan\r\n' } };
    const persist = vi.fn().mockResolvedValue(2);

    await expect(gate.persistIfChanged(changed, persist)).resolves.toEqual({ changed: true, value: 2 });
    expect(persist).toHaveBeenCalledOnce();
    expect(gate.hasChanged(changed)).toBe(false);
  });

  it('accepts a remote snapshot and ignores an equivalent snapshot with reordered object keys', () => {
    const gate = new SnapshotPersistenceGate({ revision: 1 });
    gate.accept({ body: { textRuns: [], dataStream: 'Remote\r\n' }, id: 'paper-1' });

    expect(gate.hasChanged({ id: 'paper-1', body: { dataStream: 'Remote\r\n', textRuns: [] } })).toBe(false);
  });
});
