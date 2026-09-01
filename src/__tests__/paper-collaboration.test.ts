import { describe, expect, it } from 'vitest';
import { PaperCollaborationDocument, decodePaperOperation, encodePaperOperation } from '../lib/paper-collaboration';

const snapshot = (text: string) => ({
  id: 'paper-1',
  body: { dataStream: text, textRuns: [], paragraphs: [] },
});

describe('Paper CRDT collaboration', () => {
  it('converges concurrent edits made from the same legacy snapshot', () => {
    const first = new PaperCollaborationDocument('paper-1', snapshot('Plan\r\n'));
    const second = new PaperCollaborationDocument('paper-1', snapshot('Plan\r\n'));

    const firstUpdate = first.updateFromSnapshot(snapshot('Plan A\r\n'));
    const secondUpdate = second.updateFromSnapshot(snapshot('Plan B\r\n'));
    expect(firstUpdate).not.toBeNull();
    expect(secondUpdate).not.toBeNull();

    first.applyOperation(secondUpdate!);
    second.applyOperation(firstUpdate!);

    expect(first.text).toBe(second.text);
    expect(first.snapshot()).toEqual(second.snapshot());
    expect(first.text).toContain('A');
    expect(first.text).toContain('B');
  });

  it('round trips typed update envelopes and rejects malformed updates', () => {
    const document = new PaperCollaborationDocument('paper-1', snapshot('Plan\r\n'));
    const operation = document.updateFromSnapshot(snapshot('Updated\r\n'))!;
    expect(decodePaperOperation(encodePaperOperation(operation))).toEqual(operation);
    expect(decodePaperOperation('AQID')).toBeNull();
  });

  it('restores a checkpoint and accepts updates created after that checkpoint', () => {
    const first = new PaperCollaborationDocument('paper-1', snapshot('Plan\r\n'));
    first.updateFromSnapshot(snapshot('Plan one\r\n'));
    const checkpoint = first.checkpoint();
    const restored = new PaperCollaborationDocument('paper-1', checkpoint);
    const later = first.updateFromSnapshot(snapshot('Plan one two\r\n'))!;

    restored.applyOperation(later);

    expect(restored.text).toBe(first.text);
    expect(restored.snapshot()).toEqual(first.snapshot());
  });
});
