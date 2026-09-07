import { describe, expect, it, vi } from 'vitest';
import { registerDiagramWebMCP, registerPaperWebMCP, registerWebAppWebMCP, type EditorWebMCPTool } from '../lib/editor-webmcp';

class FakeModelContext {
  tools = new Map<string, EditorWebMCPTool>();
  registerTool(tool: EditorWebMCPTool, options?: { signal?: AbortSignal }) { this.tools.set(tool.name, tool); options?.signal?.addEventListener('abort', () => this.tools.delete(tool.name)); }
}
const ownerDocument = (modelContext: FakeModelContext) => ({ modelContext, defaultView: { console } }) as never;

describe('editor WebMCP', () => {
  it('reads and writes collaborative Papers', async () => {
    const modelContext = new FakeModelContext(); let text = 'Draft';
    registerPaperWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'paper-1', name: 'Plan', getText: () => text, writeText: next => { text = next; } });
    await modelContext.tools.get('write_document')?.execute({ mode: 'append', text: ' ready' });
    expect((await modelContext.tools.get('read_document')?.execute({}))?.structuredContent).toEqual({ text: 'Draft ready' });
  });

  it('upserts and deletes collaborative Diagram elements', async () => {
    const modelContext = new FakeModelContext(); let scene = { elements: [{ id: 'old', type: 'rectangle' }] };
    registerDiagramWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'diagram-1', name: 'Flow', getScene: () => scene, writeScene: next => { scene = next; } });
    await modelContext.tools.get('upsert_diagram_elements')?.execute({ elements: [{ id: 'new', type: 'ellipse' }] });
    await modelContext.tools.get('delete_diagram_elements')?.execute({ ids: ['old'] });
    expect(scene.elements).toEqual([{ id: 'new', type: 'ellipse' }]);
  });

  it('lets agents inspect and edit Web App files and read selector comments', async () => {
    const modelContext = new FakeModelContext(); let bundle: { entrypoint: string; files: Record<string, string> } = { entrypoint: 'index.html', files: { 'index.html': '<button>Buy</button>', 'app.js': '' } };
    registerWebAppWebMCP({ ownerDocument: ownerDocument(modelContext), id: 'app-1', name: 'Checkout', getBundle: () => bundle, writeBundle: next => { bundle = next; }, getComments: () => [{ id: 'comment-1', body: 'Make this clearer', resolvedAt: null, anchor: { kind: 'webapp', selector: 'button', tag: 'button', text: 'Buy' } }] });
    expect([...modelContext.tools.keys()]).toEqual(['read_me', 'inspect_web_app', 'list_web_app_files', 'read_web_app_file', 'read_web_app_comments', 'write_web_app_files', 'delete_web_app_files']);
    await modelContext.tools.get('write_web_app_files')?.execute({ files: [{ path: 'styles.css', content: 'button { color: blue; }' }] });
    expect(bundle.files['styles.css']).toContain('blue');
    expect((await modelContext.tools.get('read_web_app_comments')?.execute({}))?.structuredContent).toMatchObject({ comments: [expect.objectContaining({ anchor: expect.objectContaining({ selector: 'button' }) })] });
  });

  it('keeps viewers read-only across editor types', () => {
    const paper = new FakeModelContext(); registerPaperWebMCP({ ownerDocument: ownerDocument(paper), id: 'p', name: 'P', canEdit: false, getText: () => '', writeText: vi.fn() });
    const diagram = new FakeModelContext(); registerDiagramWebMCP({ ownerDocument: ownerDocument(diagram), id: 'd', name: 'D', canEdit: false, getScene: () => ({ elements: [] }), writeScene: vi.fn() });
    const webapp = new FakeModelContext(); registerWebAppWebMCP({ ownerDocument: ownerDocument(webapp), id: 'w', name: 'W', canEdit: false, getBundle: () => ({ entrypoint: 'index.html', files: { 'index.html': '' } }), writeBundle: vi.fn() });
    expect(paper.tools.has('write_document')).toBe(false); expect(diagram.tools.has('upsert_diagram_elements')).toBe(false); expect(webapp.tools.has('write_web_app_files')).toBe(false);
  });
});
