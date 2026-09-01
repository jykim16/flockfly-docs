export type CheckpointDisposition = 'ignore' | 'advance' | 'reload';

export function initialOperationRecoveryRevision(snapshotRevision: number): number {
  return snapshotRevision;
}

export function checkpointDisposition(currentRevision: number, checkpointRevision: number): CheckpointDisposition {
  if (checkpointRevision <= currentRevision) return 'ignore';
  return checkpointRevision === currentRevision + 1 ? 'advance' : 'reload';
}
