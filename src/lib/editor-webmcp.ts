import { normalizeDiagramScene, type DiagramScene, type ExcalidrawElement } from './diagram-operations';
import { normalizeWebAppBundle, type WebAppBundle } from './webapp-operations';

interface EditorWebMCPTextContent { type: 'text'; text: string }
export interface EditorWebMCPResult { content: EditorWebMCPTextContent[]; structuredContent?: Record<string, unknown>; isError?: boolean }
export interface EditorWebMCPTool { name: string; description: string; inputSchema: Record<string, unknown>; execute: (input: Record<string, unknown>) => Promise<EditorWebMCPResult> | EditorWebMCPResult }
interface EditorModelContext { registerTool: (tool: EditorWebMCPTool, options?: { signal?: AbortSignal }) => Promise<void> | void }
type EditorWebMCPDocument = Document & { modelContext?: EditorModelContext };

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const result = (message: string, structuredContent?: Record<string, unknown>): EditorWebMCPResult => ({ content: [{ type: 'text', text: message }], ...(structuredContent ? { structuredContent } : {}) });
const toolError = (error: unknown): EditorWebMCPResult => ({ ...result(error instanceof Error ? error.message : String(error)), isError: true });

function registerTools(ownerDocument: EditorWebMCPDocument, tools: EditorWebMCPTool[]): () => void {
  const controller = new AbortController(); const modelContext = ownerDocument.modelContext;
  if (!modelContext) return () => controller.abort();
  const ownerConsole = ownerDocument.defaultView?.console ?? console;
  for (const tool of tools) {
    try { void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(error => ownerConsole.error(`Failed to register WebMCP tool "${tool.name}"`, error)); }
    catch (error) { ownerConsole.error(`Failed to register WebMCP tool "${tool.name}"`, error); }
  }
  return () => controller.abort();
}

interface RegisterPaperWebMCPOptions { ownerDocument: EditorWebMCPDocument; id: string; name: string; canEdit?: boolean; getText: () => string; writeText: (text: string) => void | Promise<void> }
export function registerPaperWebMCP({ ownerDocument, id, name, canEdit = true, getText, writeText }: RegisterPaperWebMCPOptions): () => void {
  const tools: EditorWebMCPTool[] = [
    { name: 'read_me', description: 'Describe the WebMCP tools available for the open Flockdoc Paper.', inputSchema: objectSchema({}), execute: () => result('Use inspect_document for metadata, read_document for text, and write_document when editing is allowed.') },
    { name: 'inspect_document', description: 'Inspect the open Flockdoc Paper.', inputSchema: objectSchema({}), execute: () => { const text = getText(); return result(`${name}: ${text.length} characters.`, { id, name, characterCount: text.length, canEdit }); } },
    { name: 'read_document', description: 'Read all plain text from the open Flockdoc Paper.', inputSchema: objectSchema({}), execute: () => { const text = getText(); return result(text || '(empty document)', { text }); } },
  ];
  if (canEdit) tools.push({ name: 'write_document', description: 'Replace or append text. The edit is saved and shared with collaborators.', inputSchema: objectSchema({ text: { type: 'string' }, mode: { type: 'string', enum: ['replace', 'append'] } }, ['text', 'mode']), execute: async input => {
    try { if (typeof input.text !== 'string') throw new Error('text must be a string.'); if (input.mode !== 'replace' && input.mode !== 'append') throw new Error('mode must be replace or append.'); const text = input.mode === 'append' ? `${getText()}${input.text}` : input.text; await writeText(text); return result(`Wrote ${text.length} characters to ${name}.`, { id, name, text, mode: input.mode }); } catch (error) { return toolError(error); }
  } });
  return registerTools(ownerDocument, tools);
}

interface RegisterDiagramWebMCPOptions { ownerDocument: EditorWebMCPDocument; id: string; name: string; canEdit?: boolean; getScene: () => DiagramScene; writeScene: (scene: DiagramScene) => void | Promise<void> }
export function registerDiagramWebMCP({ ownerDocument, id, name, canEdit = true, getScene, writeScene }: RegisterDiagramWebMCPOptions): () => void {
  const tools: EditorWebMCPTool[] = [
    { name: 'read_me', description: 'Describe the WebMCP tools available for the open Flockdoc Diagram.', inputSchema: objectSchema({}), execute: () => result('Use inspect_diagram, read_diagram, and the element mutation tools when editing is allowed.') },
    { name: 'inspect_diagram', description: 'Inspect the open Flockdoc Diagram.', inputSchema: objectSchema({}), execute: () => { const scene = getScene(); return result(`${name}: ${scene.elements.length} elements.`, { id, name, elementCount: scene.elements.length, canEdit }); } },
    { name: 'read_diagram', description: 'Read the complete Excalidraw scene.', inputSchema: objectSchema({}), execute: () => { const scene = normalizeDiagramScene(getScene()); return result(JSON.stringify(scene), { scene }); } },
  ];
  if (canEdit) tools.push(
    { name: 'upsert_diagram_elements', description: 'Add or replace complete Excalidraw elements by id.', inputSchema: objectSchema({ elements: { type: 'array', items: { type: 'object' } } }, ['elements']), execute: async input => { try { if (!Array.isArray(input.elements)) throw new Error('elements must be an array.'); const incoming = normalizeDiagramScene({ elements: input.elements }).elements; const ids = new Set(incoming.map(element => element.id)); const scene = normalizeDiagramScene({ elements: [...normalizeDiagramScene(getScene()).elements.filter(element => !ids.has(element.id)), ...incoming] }); await writeScene(scene); return result(`Upserted ${incoming.length} elements in ${name}.`, { scene }); } catch (error) { return toolError(error); } } },
    { name: 'delete_diagram_elements', description: 'Delete Excalidraw elements by id.', inputSchema: objectSchema({ ids: { type: 'array', items: { type: 'string' } } }, ['ids']), execute: async input => { try { if (!Array.isArray(input.ids) || input.ids.some(value => typeof value !== 'string')) throw new Error('ids must be an array of strings.'); const ids = new Set(input.ids as string[]); const current = normalizeDiagramScene(getScene()); const scene = normalizeDiagramScene({ elements: current.elements.filter((element: ExcalidrawElement) => !ids.has(element.id)) }); await writeScene(scene); return result(`Deleted ${current.elements.length - scene.elements.length} elements from ${name}.`, { scene }); } catch (error) { return toolError(error); } } },
  );
  return registerTools(ownerDocument, tools);
}

interface WebAppCommentForAgent { id: string; body: string; resolvedAt: string | null; anchor: Record<string, unknown> }
interface RegisterWebAppWebMCPOptions { ownerDocument: EditorWebMCPDocument; id: string; name: string; canEdit?: boolean; getBundle: () => WebAppBundle; writeBundle: (bundle: WebAppBundle) => void | Promise<void>; getComments?: () => WebAppCommentForAgent[] | Promise<WebAppCommentForAgent[]> }
export function registerWebAppWebMCP({ ownerDocument, id, name, canEdit = true, getBundle, writeBundle, getComments }: RegisterWebAppWebMCPOptions): () => void {
  const readBundle = () => normalizeWebAppBundle(getBundle());
  const tools: EditorWebMCPTool[] = [
    { name: 'read_me', description: 'Describe the WebMCP tools available for the open Flockdoc Web App.', inputSchema: objectSchema({}), execute: () => result('Use inspect_web_app and the file tools to understand the bundle. read_web_app_comments returns element selectors and feedback.') },
    { name: 'inspect_web_app', description: 'Inspect the Web App entrypoint and files.', inputSchema: objectSchema({}), execute: () => { const bundle = readBundle(); return result(`${name}: ${Object.keys(bundle.files).length} files.`, { id, name, entrypoint: bundle.entrypoint, files: Object.keys(bundle.files), canEdit }); } },
    { name: 'list_web_app_files', description: 'List every file in the Web App bundle.', inputSchema: objectSchema({}), execute: () => { const bundle = readBundle(); return result(Object.keys(bundle.files).join('\n'), { entrypoint: bundle.entrypoint, files: Object.keys(bundle.files).map(path => ({ path, characters: bundle.files[path].length })) }); } },
    { name: 'read_web_app_file', description: 'Read one HTML, CSS, or JavaScript file.', inputSchema: objectSchema({ path: { type: 'string' } }, ['path']), execute: input => { try { if (typeof input.path !== 'string') throw new Error('path must be a string.'); const content = readBundle().files[input.path]; if (content === undefined) throw new Error(`File not found: ${input.path}`); return result(content, { path: input.path, content }); } catch (error) { return toolError(error); } } },
    { name: 'read_web_app_comments', description: 'Read comments with stable selector, tag, and visible-text anchors.', inputSchema: objectSchema({}), execute: async () => { const comments = getComments ? await getComments() : []; return result(comments.length ? JSON.stringify(comments) : 'No comments.', { comments }); } },
  ];
  if (canEdit) tools.push(
    { name: 'write_web_app_files', description: 'Add or replace HTML, CSS, or JavaScript files and optionally change the entrypoint.', inputSchema: objectSchema({ files: { type: 'array', items: objectSchema({ path: { type: 'string' }, content: { type: 'string' } }, ['path', 'content']) }, entrypoint: { type: 'string' } }, ['files']), execute: async input => { try { if (!Array.isArray(input.files)) throw new Error('files must be an array.'); const current = readBundle(); const files = { ...current.files }; for (const file of input.files as Array<Record<string, unknown>>) { if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') throw new Error('Each file requires path and content strings.'); files[file.path] = file.content; } const bundle = normalizeWebAppBundle({ entrypoint: typeof input.entrypoint === 'string' ? input.entrypoint : current.entrypoint, files }); await writeBundle(bundle); return result(`Wrote ${input.files.length} files to ${name}.`, { bundle }); } catch (error) { return toolError(error); } } },
    { name: 'delete_web_app_files', description: 'Delete files without deleting the active entrypoint.', inputSchema: objectSchema({ paths: { type: 'array', items: { type: 'string' } } }, ['paths']), execute: async input => { try { if (!Array.isArray(input.paths) || input.paths.some(path => typeof path !== 'string')) throw new Error('paths must be an array of strings.'); const current = readBundle(); if ((input.paths as string[]).includes(current.entrypoint)) throw new Error('The active entrypoint cannot be deleted.'); const files = { ...current.files }; for (const path of input.paths as string[]) delete files[path]; const bundle = normalizeWebAppBundle({ ...current, files }); await writeBundle(bundle); return result(`Deleted ${input.paths.length} files from ${name}.`, { bundle }); } catch (error) { return toolError(error); } } },
  );
  return registerTools(ownerDocument, tools);
}
