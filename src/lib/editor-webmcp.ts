import { normalizeDiagramScene, type DiagramScene, type ExcalidrawElement } from './diagram-operations';

interface EditorWebMCPTextContent {
  type: 'text';
  text: string;
}

export interface EditorWebMCPResult {
  content: EditorWebMCPTextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface EditorWebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<EditorWebMCPResult> | EditorWebMCPResult;
}

interface EditorModelContext {
  registerTool: (tool: EditorWebMCPTool, options?: { signal?: AbortSignal }) => Promise<void> | void;
}

type EditorWebMCPDocument = Document & { modelContext?: EditorModelContext };

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const result = (message: string, structuredContent?: Record<string, unknown>): EditorWebMCPResult => ({
  content: [{ type: 'text', text: message }],
  ...(structuredContent ? { structuredContent } : {}),
});

function toolError(error: unknown): EditorWebMCPResult {
  return { ...result(error instanceof Error ? error.message : String(error)), isError: true };
}

function registerTools(ownerDocument: EditorWebMCPDocument, tools: EditorWebMCPTool[]): () => void {
  const controller = new AbortController();
  const modelContext = ownerDocument.modelContext;
  if (!modelContext) return () => controller.abort();
  const ownerConsole = ownerDocument.defaultView?.console ?? console;
  for (const tool of tools) {
    try {
      void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(error => {
        ownerConsole.error(`Failed to register WebMCP tool "${tool.name}"`, error);
      });
    } catch (error) {
      ownerConsole.error(`Failed to register WebMCP tool "${tool.name}"`, error);
    }
  }
  return () => controller.abort();
}

interface RegisterPaperWebMCPOptions {
  ownerDocument: EditorWebMCPDocument;
  id: string;
  name: string;
  canEdit?: boolean;
  getText: () => string;
  writeText: (text: string) => void | Promise<void>;
}

export function registerPaperWebMCP({ ownerDocument, id, name, canEdit = true, getText, writeText }: RegisterPaperWebMCPOptions): () => void {
  const tools: EditorWebMCPTool[] = [
    {
      name: 'read_me',
      description: 'Describe the WebMCP tools available for the open Flockdoc Paper.',
      inputSchema: objectSchema({}),
      execute: () => result('Use inspect_document for metadata, read_document for the current text, and write_document to replace or append text when editing is allowed.'),
    },
    {
      name: 'inspect_document',
      description: 'Inspect the open Flockdoc Paper and report its identity and text length.',
      inputSchema: objectSchema({}),
      execute: () => {
        const text = getText();
        return result(`${name}: ${text.length} characters.`, { id, name, characterCount: text.length, canEdit });
      },
    },
    {
      name: 'read_document',
      description: 'Read all plain text from the open Flockdoc Paper.',
      inputSchema: objectSchema({}),
      execute: () => {
        const text = getText();
        return result(text || '(empty document)', { text });
      },
    },
  ];

  if (canEdit) tools.push({
    name: 'write_document',
    description: 'Replace all text in the open Flockdoc Paper or append text to its end. The edit is saved and shared with collaborators.',
    inputSchema: objectSchema({
      text: { type: 'string', description: 'The text to write.' },
      mode: { type: 'string', enum: ['replace', 'append'], description: 'Replace the document or append to it.' },
    }, ['text', 'mode']),
    execute: async input => {
      try {
        if (typeof input.text !== 'string') throw new Error('text must be a string.');
        if (input.mode !== 'replace' && input.mode !== 'append') throw new Error('mode must be replace or append.');
        const text = input.mode === 'append' ? `${getText()}${input.text}` : input.text;
        await writeText(text);
        return result(`Wrote ${text.length} characters to ${name}.`, { id, name, text, mode: input.mode });
      } catch (error) {
        return toolError(error);
      }
    },
  });

  return registerTools(ownerDocument, tools);
}

interface RegisterDiagramWebMCPOptions {
  ownerDocument: EditorWebMCPDocument;
  id: string;
  name: string;
  canEdit?: boolean;
  getScene: () => DiagramScene;
  writeScene: (scene: DiagramScene) => void | Promise<void>;
}

export function registerDiagramWebMCP({ ownerDocument, id, name, canEdit = true, getScene, writeScene }: RegisterDiagramWebMCPOptions): () => void {
  const tools: EditorWebMCPTool[] = [
    {
      name: 'read_me',
      description: 'Describe the WebMCP tools available for the open Flockdoc Diagram.',
      inputSchema: objectSchema({}),
      execute: () => result('Use inspect_diagram for metadata, read_diagram for the Excalidraw scene, and the element mutation tools when editing is allowed.'),
    },
    {
      name: 'inspect_diagram',
      description: 'Inspect the open Flockdoc Diagram and report its identity and element count.',
      inputSchema: objectSchema({}),
      execute: () => {
        const scene = getScene();
        return result(`${name}: ${scene.elements.length} elements.`, { id, name, elementCount: scene.elements.length, canEdit });
      },
    },
    {
      name: 'read_diagram',
      description: 'Read the complete Excalidraw element scene from the open Flockdoc Diagram.',
      inputSchema: objectSchema({}),
      execute: () => {
        const scene = normalizeDiagramScene(getScene());
        return result(JSON.stringify(scene), { scene });
      },
    },
  ];

  if (canEdit) tools.push(
    {
      name: 'upsert_diagram_elements',
      description: 'Add or replace Excalidraw elements by id in the open Flockdoc Diagram. Provide complete Excalidraw element objects. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({ elements: { type: 'array', items: { type: 'object' } } }, ['elements']),
      execute: async input => {
        try {
          if (!Array.isArray(input.elements)) throw new Error('elements must be an array.');
          const incoming = normalizeDiagramScene({ elements: input.elements }).elements;
          const incomingIds = new Set(incoming.map(element => element.id));
          const current = normalizeDiagramScene(getScene()).elements.filter(element => !incomingIds.has(element.id));
          const scene = normalizeDiagramScene({ elements: [...current, ...incoming] });
          await writeScene(scene);
          return result(`Upserted ${incoming.length} elements in ${name}.`, { scene });
        } catch (error) {
          return toolError(error);
        }
      },
    },
    {
      name: 'delete_diagram_elements',
      description: 'Delete Excalidraw elements by id from the open Flockdoc Diagram. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({ ids: { type: 'array', items: { type: 'string' } } }, ['ids']),
      execute: async input => {
        try {
          if (!Array.isArray(input.ids) || input.ids.some(value => typeof value !== 'string')) throw new Error('ids must be an array of strings.');
          const ids = new Set(input.ids as string[]);
          const current = normalizeDiagramScene(getScene());
          const scene = normalizeDiagramScene({ elements: current.elements.filter((element: ExcalidrawElement) => !ids.has(element.id)) });
          await writeScene(scene);
          return result(`Deleted ${current.elements.length - scene.elements.length} elements from ${name}.`, { scene });
        } catch (error) {
          return toolError(error);
        }
      },
    },
  );

  return registerTools(ownerDocument, tools);
}
