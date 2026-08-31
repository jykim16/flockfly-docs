import { describe, expect, it, vi } from 'vitest';
import { registerFlockdocWebMCP } from '../lib/webmcp';

describe('Flockdoc WebMCP bridge', () => {
  it('exposes only workspace operations backed by real local state', () => {
    const registerTool = vi.fn();
    const dispose = registerFlockdocWebMCP({
      modelContext: { registerTool },
      actions: {
        listFlockdocs: vi.fn(),
        createFlockdoc: vi.fn(),
        renameFlockdoc: vi.fn(),
        createFolder: vi.fn(),
        moveFlockdoc: vi.fn(),
        deleteFlockdoc: vi.fn(),
      },
    });

    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      'flockdoc.list',
      'flockdoc.create',
      'flockdoc.rename',
      'flockdoc.create_folder',
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
        createFlockdoc: vi.fn(),
        renameFlockdoc: vi.fn(),
        createFolder: vi.fn(),
        moveFlockdoc: vi.fn(),
        deleteFlockdoc: vi.fn(),
        shareFlockdoc: vi.fn(),
        commentOnFlockdoc: vi.fn(),
      } as never,
    });

    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      'flockdoc.list',
      'flockdoc.create',
      'flockdoc.rename',
      'flockdoc.create_folder',
      'flockdoc.move',
      'flockdoc.delete',
    ]);
  });
});
