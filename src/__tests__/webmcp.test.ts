import { describe, expect, it, vi } from 'vitest';
import { registerFlockdocWebMCP } from '../lib/webmcp';

describe('Flockdoc WebMCP bridge', () => {
  it('exposes only workspace operations backed by real local state', () => {
    const registerTool = vi.fn();
    const dispose = registerFlockdocWebMCP({
      modelContext: { registerTool },
      actions: {
        listFlockdocs: vi.fn(),
        openFlockdoc: vi.fn(),
        createFlockdoc: vi.fn(),
        renameFlockdoc: vi.fn(),
        moveFlockdoc: vi.fn(),
        deleteFlockdoc: vi.fn(),
      },
    });

    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      'flockdoc.list',
      'flockdoc.open',
      'flockdoc.create',
      'flockdoc.rename',
      'flockdoc.move',
      'flockdoc.delete',
    ]);
    dispose();
  });

  it('does not expose sharing or comments before a specific document is open', () => {
    const registerTool = vi.fn();
    registerFlockdocWebMCP({
      modelContext: { registerTool },
      actions: {
        listFlockdocs: vi.fn(),
        openFlockdoc: vi.fn(),
        createFlockdoc: vi.fn(),
        renameFlockdoc: vi.fn(),
        moveFlockdoc: vi.fn(),
        deleteFlockdoc: vi.fn(),
        shareFlockdoc: vi.fn(),
        commentOnFlockdoc: vi.fn(),
      } as never,
    });

    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      'flockdoc.list',
      'flockdoc.open',
      'flockdoc.create',
      'flockdoc.rename',
      'flockdoc.move',
      'flockdoc.delete',
    ]);
  });

  it('uses prefix fields for create and move tool inputs', () => {
    const registerTool = vi.fn();
    registerFlockdocWebMCP({ modelContext: { registerTool }, actions: {
      listFlockdocs: vi.fn(), openFlockdoc: vi.fn(), createFlockdoc: vi.fn(), renameFlockdoc: vi.fn(), moveFlockdoc: vi.fn(), deleteFlockdoc: vi.fn(),
    } });
    const tools = Object.fromEntries(registerTool.mock.calls.map(([tool]) => [tool.name, tool]));
    expect(tools['flockdoc.open'].inputSchema.properties).toEqual({ id: { type: 'string' } });
    expect(tools['flockdoc.open'].inputSchema.required).toEqual(['id']);
    expect(tools['flockdoc.create'].inputSchema.properties).toHaveProperty('prefix');
    expect(tools['flockdoc.move'].inputSchema.properties).toEqual(expect.objectContaining({ prefix: { type: 'string' } }));
    expect(tools['flockdoc.move'].inputSchema.required).toEqual(['id', 'prefix']);
  });

  it('delegates open requests and returns the navigation result', async () => {
    const registerTool = vi.fn();
    const openFlockdoc = vi.fn().mockReturnValue({ opened: true, path: '/flockdoc/paper/paper-1' });
    registerFlockdocWebMCP({ modelContext: { registerTool }, actions: {
      listFlockdocs: vi.fn(), openFlockdoc, createFlockdoc: vi.fn(), renameFlockdoc: vi.fn(), moveFlockdoc: vi.fn(), deleteFlockdoc: vi.fn(),
    } });
    const openTool = registerTool.mock.calls.map(([tool]) => tool).find(tool => tool.name === 'flockdoc.open');

    await expect(Promise.resolve(openTool.execute({ id: 'paper-1' }))).resolves.toEqual({ opened: true, path: '/flockdoc/paper/paper-1' });
    expect(openFlockdoc).toHaveBeenCalledWith({ id: 'paper-1' });
  });
});
