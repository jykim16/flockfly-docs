import { describe, expect, it } from 'vitest';
import { checkpointDisposition, initialOperationRecoveryRevision } from '../lib/operation-recovery';

describe('operation-only recovery', () => {
  it('always replays from the authoritative checkpoint revision', () => {
    expect(initialOperationRecoveryRevision(4)).toBe(4);
  });

  it('advances through contiguous checkpoints without reloading the editor', () => {
    expect(checkpointDisposition(8, 8)).toBe('ignore');
    expect(checkpointDisposition(8, 9)).toBe('advance');
    expect(checkpointDisposition(8, 11)).toBe('reload');
  });
});
