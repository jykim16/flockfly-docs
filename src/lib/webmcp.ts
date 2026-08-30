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
  shareFlockdoc?: (input: Record<string, unknown>) => unknown;
  commentOnFlockdoc?: (input: Record<string, unknown>) => unknown;
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
  ];

  if (actions.shareFlockdoc) tools.push({
    name: 'flockdoc.share',
    description: 'Grant a user, team, agent, or link a role on a flockdoc. The server enforces the caller\'s share permission.',
    inputSchema: objectSchema({
      id: { type: 'string' },
      principalType: { enum: ['user', 'team', 'agent', 'link'] },
      principalId: { type: 'string' },
      role: { enum: ['manager', 'editor', 'commenter', 'viewer'] },
    }, ['id', 'principalType', 'principalId', 'role']),
    execute: actions.shareFlockdoc,
  });
  if (actions.commentOnFlockdoc) tools.push({
    name: 'flockdoc.comment',
    description: 'Add a comment to a flockdoc through the server-enforced comment permission.',
    inputSchema: objectSchema({ id: { type: 'string' }, body: { type: 'string' }, anchor: { type: 'object' } }, ['id', 'body']),
    execute: actions.commentOnFlockdoc,
  });

  for (const tool of tools) void modelContext.registerTool(tool, { signal: controller.signal });
  return () => controller.abort();
}

declare global {
  interface Document { modelContext?: WebMCPModelContext }
}
