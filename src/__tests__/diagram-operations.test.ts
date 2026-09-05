import { describe, expect, it } from 'vitest';
import { decodeDiagramOperation, encodeDiagramOperation, normalizeDiagramScene } from '../lib/diagram-operations';

describe('diagram operations', () => {
  it('round-trips an Excalidraw scene through the realtime transport', () => {
    const operation = {
      protocolVersion: 1 as const,
      kind: 'diagram.excalidraw.update' as const,
      scene: { elements: [{ id: 'box-1', type: 'rectangle', x: 10, y: 20, isDeleted: false }] },
    };

    expect(decodeDiagramOperation(encodeDiagramOperation(operation))).toEqual(operation);
  });

  it('normalizes deleted elements and rejects invalid snapshots', () => {
    expect(normalizeDiagramScene({ elements: [
      { id: 'live', type: 'text', text: 'Hello', isDeleted: false },
      { id: 'gone', type: 'rectangle', isDeleted: true },
    ] })).toEqual({ elements: [{ id: 'live', type: 'text', text: 'Hello', isDeleted: false }] });
    expect(() => normalizeDiagramScene({ elements: 'invalid' })).toThrow('elements');
  });
});
