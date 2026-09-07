import { describe, expect, it, vi } from 'vitest';
import { registerDiagramWebMCP, registerPaperWebMCP, registerPresentationWebMCP, type EditorWebMCPTool } from '../lib/editor-webmcp';
import type { PresentationSnapshot } from '../lib/presentation-operations';

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
  const initial: PresentationSnapshot = {
    id: 'deck-1',
    title: 'Launch',
    pageSize: { width: 960, height: 540 },
    body: { pageOrder: ['one'], pages: { one: { id: 'one', pageElements: {} } } },
  };

  it('registers collaborative slide tools for editors', async () => {
    const modelContext = new FakeModelContext();
    let snapshot = structuredClone(initial);
    const writeSnapshot = vi.fn(async (next: PresentationSnapshot) => { snapshot = next; });
    const cleanup = registerPresentationWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'deck-1', name: 'Launch', canEdit: true, getSnapshot: () => snapshot, writeSnapshot });

    expect([...modelContext.tools.keys()]).toEqual([
      'read_me', 'inspect_presentation', 'read_presentation', 'replace_presentation',
      'create_slide', 'upsert_slides', 'delete_slides', 'add_slide_text',
      'add_slide_shape', 'add_slide_image', 'update_slide_element', 'delete_slide_elements',
    ]);
    const created = await modelContext.tools.get('create_slide')?.execute({ title: 'Overview', position: 1 });
    const createdId = created?.structuredContent?.slideId as string;
    expect(snapshot.body.pageOrder).toEqual(['one', createdId]);

    const textResult = await modelContext.tools.get('add_slide_text')?.execute({
      slideId: createdId, text: 'Launch plan', x: 80, y: 60, width: 700, height: 80, fontSize: 42, color: '#123456', bold: true,
    });
    const textId = textResult?.structuredContent?.elementId as string;
    expect(snapshot.body.pages[createdId].pageElements[textId]).toMatchObject({
      left: 80, top: 60, width: 700, height: 80, type: 2,
      richText: { text: 'Launch plan', fs: 42, cl: { rgb: '#123456' }, bl: 1 },
    });

    await modelContext.tools.get('add_slide_shape')?.execute({ slideId: createdId, shape: 'roundRect', x: 100, y: 180, width: 300, height: 160, fill: '#ddeeff', stroke: '#112233' });
    await modelContext.tools.get('add_slide_image')?.execute({ slideId: createdId, url: 'https://example.com/chart.png', x: 450, y: 180, width: 360, height: 240, alt: 'Quarterly chart' });
    expect(Object.values(snapshot.body.pages[createdId].pageElements)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 0, shape: expect.objectContaining({ shapeType: 'roundRect' }) }),
      expect.objectContaining({ type: 1, description: 'Quarterly chart', image: { imageProperties: { contentUrl: 'https://example.com/chart.png', sourceUrl: 'https://example.com/chart.png' } } }),
    ]));

    await modelContext.tools.get('update_slide_element')?.execute({ slideId: createdId, elementId: textId, text: 'Updated plan', x: 120 });
    expect(snapshot.body.pages[createdId].pageElements[textId]).toMatchObject({ left: 120, richText: expect.objectContaining({ text: 'Updated plan' }) });
    await modelContext.tools.get('delete_slide_elements')?.execute({ slideId: createdId, ids: [textId] });
    expect(snapshot.body.pages[createdId].pageElements).not.toHaveProperty(textId);

    await modelContext.tools.get('upsert_slides')?.execute({ slides: [{ id: 'two', pageElements: {} }] });
    expect(snapshot.body.pageOrder).toEqual(['one', createdId, 'two']);
    await modelContext.tools.get('delete_slides')?.execute({ ids: ['one', createdId] });
    expect(snapshot.body.pageOrder).toEqual(['two']);

    cleanup();
    expect(modelContext.tools.size).toBe(0);
  });

  it('omits presentation mutation tools for viewers', () => {
    const modelContext = new FakeModelContext();
    registerPresentationWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'deck-1', name: 'Launch', canEdit: false, getSnapshot: () => initial, writeSnapshot: vi.fn() });
    expect([...modelContext.tools.keys()]).toEqual(['read_me', 'inspect_presentation', 'read_presentation']);
  });

  it('returns useful errors for invalid slide content requests', async () => {
    const modelContext = new FakeModelContext();
    registerPresentationWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'deck-1', name: 'Launch', getSnapshot: () => initial, writeSnapshot: vi.fn() });
    expect((await modelContext.tools.get('add_slide_text')?.execute({ slideId: 'missing', text: 'Hello' }))?.isError).toBe(true);
    expect((await modelContext.tools.get('add_slide_text')?.execute({ slideId: 'one', text: 'Hello', bold: 'yes' }))?.isError).toBe(true);
    expect((await modelContext.tools.get('add_slide_shape')?.execute({ slideId: 'one', shape: 'triangle' }))?.isError).toBe(true);
    expect((await modelContext.tools.get('add_slide_image')?.execute({ slideId: 'one', url: 'javascript:alert(1)' }))?.isError).toBe(true);
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
