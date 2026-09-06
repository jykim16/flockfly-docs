import { describe, expect, it } from 'vitest';
import { decodePresentationOperation, encodePresentationOperation, normalizePresentationSnapshot, presentationOperation } from '../lib/presentation-operations';

describe('presentation operations', () => {
  const snapshot = {
    id: 'deck-1',
    title: 'Launch',
    pageSize: { width: 960, height: 540 },
    body: { pageOrder: ['slide-1'], pages: { 'slide-1': { id: 'slide-1', pageElements: {} } } },
  };

  it('round-trips normalized Univer slide snapshots', () => {
    const operation = presentationOperation(snapshot);
    expect(operation.kind).toBe('presentation.univer.update');
    expect(decodePresentationOperation(encodePresentationOperation(operation))).toEqual(operation);
  });

  it('creates a safe blank deck from invalid input', () => {
    expect(normalizePresentationSnapshot(null, 'deck-1', 'Untitled Presentation')).toMatchObject({
      id: 'deck-1', title: 'Untitled Presentation', body: { pageOrder: expect.any(Array), pages: expect.any(Object) },
    });
  });
});
