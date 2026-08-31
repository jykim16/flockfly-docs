export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

export interface WebMCPModelContext {
  registerTool: (tool: WebMCPTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
}

export interface FlockdocActions {
  listFlockdocs: () => unknown;
  createFlockdoc: (input: Record<string, unknown>) => unknown;
  renameFlockdoc: (input: Record<string, unknown>) => unknown;
  createFolder: (input: Record<string, unknown>) => unknown;
  moveFlockdoc: (input: Record<string, unknown>) => unknown;
  deleteFlockdoc: (input: Record<string, unknown>) => unknown;
}

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object', properties, required, additionalProperties: false,
});

export function registerFlockdocWebMCP({ modelContext, actions }: { modelContext?: WebMCPModelContext; actions: FlockdocActions }) {
  const controller = new AbortController();
  if (!modelContext) return () => controller.abort();

  const tools: WebMCPTool[] = [
    { name: 'flockdoc.list', description: 'List the flockdocs visible in the current workspace.', inputSchema: objectSchema({}), execute: actions.listFlockdocs },
    { name: 'flockdoc.create', description: 'Create a Paper or Spreadsheet.', inputSchema: objectSchema({ type: { enum: ['paper', 'spreadsheet'] }, name: { type: 'string' } }, ['type', 'name']), execute: actions.createFlockdoc },
    { name: 'flockdoc.rename', description: 'Rename a flockdoc.', inputSchema: objectSchema({ id: { type: 'string' }, name: { type: 'string' } }, ['id', 'name']), execute: actions.renameFlockdoc },
    { name: 'flockdoc.create_folder', description: 'Create a folder in the Flockdoc workspace.', inputSchema: objectSchema({ name: { type: 'string' }, parentFolderId: { type: ['string', 'null'] } }, ['name']), execute: actions.createFolder },
    { name: 'flockdoc.move', description: 'Move a Paper or Spreadsheet to the workspace root or a folder.', inputSchema: objectSchema({ id: { type: 'string' }, parentFolderId: { type: ['string', 'null'] } }, ['id', 'parentFolderId']), execute: actions.moveFlockdoc },
    { name: 'flockdoc.delete', description: 'Move a Paper or Spreadsheet to recoverable trash.', inputSchema: objectSchema({ id: { type: 'string' } }, ['id']), execute: actions.deleteFlockdoc },
  ];

  for (const tool of tools) void modelContext.registerTool(tool, { signal: controller.signal });
  return () => controller.abort();
}

declare global {
  interface Document { modelContext?: WebMCPModelContext }
}
