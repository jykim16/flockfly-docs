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
      },
    });

    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      'flockdoc.list',
      'flockdoc.create',
      'flockdoc.rename',
    ]);
    dispose();
  });

  it('adds server-backed permissions and comments without exposing mock actions', () => {
    const registerTool = vi.fn();
    registerFlockdocWebMCP({
      modelContext: { registerTool },
      actions: {
        listFlockdocs: vi.fn(),
        createFlockdoc: vi.fn(),
        renameFlockdoc: vi.fn(),
        shareFlockdoc: vi.fn(),
        commentOnFlockdoc: vi.fn(),
      },
    });

    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      'flockdoc.list',
      'flockdoc.create',
      'flockdoc.rename',
      'flockdoc.share',
      'flockdoc.comment',
    ]);
  });
});
