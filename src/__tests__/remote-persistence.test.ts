import { describe, expect, it, vi } from 'vitest';
import { SerializedCheckpointSaver } from '../lib/checkpoint-persistence';

describe('serialized checkpoint persistence', () => {
  it('serializes concurrent saves and advances the base revision', async () => {
    const calls: Array<{ baseRevision: number; snapshot: unknown }> = [];
    const save = vi.fn(async (baseRevision: number, snapshot: unknown) => {
      calls.push({ baseRevision, snapshot });
      await Promise.resolve();
      return { revision: baseRevision + 1 };
    });
    const saver = new SerializedCheckpointSaver(4, save);

    await Promise.all([saver.save({ value: 'first' }), saver.save({ value: 'second' })]);
    expect(calls).toEqual([
      { baseRevision: 4, snapshot: { value: 'first' } },
      { baseRevision: 5, snapshot: { value: 'second' } },
    ]);
    expect(saver.revision).toBe(6);
  });

  it('does not continue from a failed revision', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('conflict')).mockResolvedValueOnce({ revision: 8 });
    const saver = new SerializedCheckpointSaver(7, save);
    await expect(saver.save({ value: 'stale' })).rejects.toThrow('conflict');
    await expect(saver.save({ value: 'retry' })).resolves.toBe(8);
    expect(save.mock.calls[1][0]).toBe(7);
  });
});
