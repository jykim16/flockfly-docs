import { describe, expect, it, vi } from 'vitest';
import { registerDiagramWebMCP, registerPaperWebMCP, registerPresentationWebMCP, type EditorWebMCPTool } from '../lib/editor-webmcp';

class FakeModelContext {
  tools = new Map<string, EditorWebMCPTool>();

  registerTool(tool: EditorWebMCPTool, options?: { signal?: AbortSignal }) {
    this.tools.set(tool.name, tool);
    options?.signal?.addEventListener('abort', () => this.tools.delete(tool.name));
  }
}

function ownerDocument(modelContext: FakeModelContext) {
  return { modelContext, defaultView: { console } } as never;
}

describe('Paper WebMCP', () => {
  it('registers collaborative read and write tools for editors', async () => {
    const modelContext = new FakeModelContext();
    let text = 'Draft';
    const writeText = vi.fn(async (next: string) => { text = next; });
    const cleanup = registerPaperWebMCP({
      ownerDocument: ownerDocument(modelContext),
      id: 'paper-1',
      name: 'Plan',
      canEdit: true,
      getText: () => text,
      writeText,
    });

    expect([...modelContext.tools.keys()]).toEqual([
      'read_me',
      'inspect_document',
      'read_document',
      'write_document',
    ]);
    await modelContext.tools.get('write_document')?.execute({ mode: 'append', text: ' ready' });
    expect(writeText).toHaveBeenCalledWith('Draft ready');
    expect((await modelContext.tools.get('read_document')?.execute({}))?.structuredContent).toEqual({ text: 'Draft ready' });

    cleanup();
    expect(modelContext.tools.size).toBe(0);
  });

  it('omits Paper mutation tools for viewers', () => {
    const modelContext = new FakeModelContext();
    registerPaperWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'paper-1', name: 'Plan', canEdit: false, getText: () => '', writeText: vi.fn() });
    expect([...modelContext.tools.keys()]).toEqual(['read_me', 'inspect_document', 'read_document']);
  });
});

describe('Presentation WebMCP', () => {
  const initial = { id: 'deck-1', title: 'Launch', body: { pageOrder: ['one'], pages: { one: { id: 'one', pageElements: {} } } } };

  it('registers collaborative slide tools for editors', async () => {
    const modelContext = new FakeModelContext();
    let snapshot = initial;
    const writeSnapshot = vi.fn(async next => { snapshot = next as typeof initial; });
    const cleanup = registerPresentationWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'deck-1', name: 'Launch', canEdit: true, getSnapshot: () => snapshot, writeSnapshot });

    expect([...modelContext.tools.keys()]).toEqual(['read_me', 'inspect_presentation', 'read_presentation', 'replace_presentation', 'upsert_slides', 'delete_slides']);
    await modelContext.tools.get('upsert_slides')?.execute({ slides: [{ id: 'two', pageElements: {} }] });
    expect(snapshot.body.pageOrder).toEqual(['one', 'two']);
    await modelContext.tools.get('delete_slides')?.execute({ ids: ['one'] });
    expect(snapshot.body.pageOrder).toEqual(['two']);

    cleanup();
    expect(modelContext.tools.size).toBe(0);
  });

  it('omits presentation mutation tools for viewers', () => {
    const modelContext = new FakeModelContext();
    registerPresentationWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'deck-1', name: 'Launch', canEdit: false, getSnapshot: () => initial, writeSnapshot: vi.fn() });
    expect([...modelContext.tools.keys()]).toEqual(['read_me', 'inspect_presentation', 'read_presentation']);
  });
});

describe('Diagram WebMCP', () => {
  it('registers collaborative scene tools for editors', async () => {
    const modelContext = new FakeModelContext();
    let scene = { elements: [{ id: 'keep', type: 'rectangle', x: 0 }, { id: 'change', type: 'text', text: 'old' }] };
    const writeScene = vi.fn(async next => { scene = next; });
    const cleanup = registerDiagramWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'diagram-1', name: 'Flow', canEdit: true, getScene: () => scene, writeScene });

    expect([...modelContext.tools.keys()]).toEqual([
      'read_me',
      'inspect_diagram',
      'read_diagram',
      'upsert_diagram_elements',
      'delete_diagram_elements',
    ]);
    await modelContext.tools.get('upsert_diagram_elements')?.execute({ elements: [{ id: 'change', type: 'text', text: 'new' }, { id: 'add', type: 'ellipse' }] });
    expect(scene.elements).toEqual([{ id: 'keep', type: 'rectangle', x: 0 }, { id: 'change', type: 'text', text: 'new' }, { id: 'add', type: 'ellipse' }]);
    await modelContext.tools.get('delete_diagram_elements')?.execute({ ids: ['keep'] });
    expect(scene.elements.map(element => element.id)).toEqual(['change', 'add']);

    cleanup();
    expect(modelContext.tools.size).toBe(0);
  });

  it('omits Diagram mutation tools for viewers', () => {
    const modelContext = new FakeModelContext();
    registerDiagramWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'diagram-1', name: 'Flow', canEdit: false, getScene: () => ({ elements: [] }), writeScene: vi.fn() });
    expect([...modelContext.tools.keys()]).toEqual(['read_me', 'inspect_diagram', 'read_diagram']);
  });
});
