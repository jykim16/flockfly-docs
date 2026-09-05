export type ExcalidrawElement = Record<string, unknown> & { id: string; type: string; isDeleted?: boolean };

export type DiagramScene = {
  elements: ExcalidrawElement[];
};

export type DiagramOperation = {
  protocolVersion: 1;
  kind: 'diagram.excalidraw.update';
  scene: DiagramScene;
};

export function normalizeDiagramScene(value: unknown): DiagramScene {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Diagram scene must be an object.');
  const elements = (value as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) throw new Error('Diagram scene elements must be an array.');
  const normalized = elements.filter((element): element is ExcalidrawElement => {
    if (!element || typeof element !== 'object' || Array.isArray(element)) throw new Error('Each Diagram element must be an object.');
    const candidate = element as Partial<ExcalidrawElement>;
    if (typeof candidate.id !== 'string' || !candidate.id || typeof candidate.type !== 'string' || !candidate.type) {
      throw new Error('Each Diagram element requires an id and type.');
    }
    return candidate.isDeleted !== true;
  });
  return { elements: structuredClone(normalized) };
}

export function diagramOperation(scene: unknown): DiagramOperation {
  return { protocolVersion: 1, kind: 'diagram.excalidraw.update', scene: normalizeDiagramScene(scene) };
}

export function encodeDiagramOperation(operation: DiagramOperation): string {
  const bytes = new TextEncoder().encode(JSON.stringify(operation));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeDiagramOperation(updateBase64: string): DiagramOperation | null {
  try {
    const binary = atob(updateBase64);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<DiagramOperation>;
    if (parsed.protocolVersion !== 1 || parsed.kind !== 'diagram.excalidraw.update') return null;
    return diagramOperation(parsed.scene);
  } catch {
    return null;
  }
}
