import { describe, expect, it } from 'vitest';
import { checkpointDisposition, initialOperationRecoveryRevision, isPairedPaperCheckpoint } from '../lib/operation-recovery';

describe('operation-only recovery', () => {
  it('always replays from the authoritative checkpoint revision', () => {
    expect(initialOperationRecoveryRevision(4)).toBe(4);
  });

  it('advances local checkpoints but reloads checkpoints committed by another client', () => {
    expect(checkpointDisposition(8, 8)).toBe('ignore');
    expect(checkpointDisposition(8, 9)).toBe('advance');
    expect(checkpointDisposition(8, 9, true)).toBe('reload');
    expect(checkpointDisposition(8, 11)).toBe('reload');
  });

  it('recognizes the paired checkpoint independently for any number of receiving sessions', () => {
    const receivers = Array.from({ length: 20 }, (_, index) => `receiver-${index}`);
    const previousOperation = { revision: 41, clientId: 'remote-author' };
    const checkpoint = { revision: 42, clientId: 'remote-author' };

    expect(receivers.every(clientId => isPairedPaperCheckpoint(41, checkpoint, previousOperation, clientId))).toBe(true);
    expect(isPairedPaperCheckpoint(40, checkpoint, previousOperation, receivers[0])).toBe(false);
    expect(isPairedPaperCheckpoint(41, { ...checkpoint, clientId: 'other-author' }, previousOperation, receivers[0])).toBe(false);
  });
});
