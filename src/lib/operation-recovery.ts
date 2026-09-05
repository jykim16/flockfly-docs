export type CheckpointDisposition = 'ignore' | 'advance' | 'reload';

export function initialOperationRecoveryRevision(snapshotRevision: number): number {
  return snapshotRevision;
}

export function checkpointDisposition(currentRevision: number, checkpointRevision: number, authoredRemotely = false): CheckpointDisposition {
  if (checkpointRevision <= currentRevision) return 'ignore';
  if (authoredRemotely) return 'reload';
  return checkpointRevision === currentRevision + 1 ? 'advance' : 'reload';
}

export function isPairedPaperCheckpoint(
  currentRevision: number,
  checkpoint: { revision: number; clientId: string },
  previousOperation: { revision: number; clientId: string } | null,
  localClientId: string,
): boolean {
  return checkpoint.clientId !== localClientId
    && previousOperation?.clientId === checkpoint.clientId
    && previousOperation.revision === currentRevision
    && checkpoint.revision === previousOperation.revision + 1;
}
