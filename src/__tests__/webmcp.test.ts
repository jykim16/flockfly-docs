import { describe, expect, it, vi } from 'vitest';
import { registerFlockdocWebMCP } from '../lib/webmcp';

describe('Flockdoc WebMCP bridge', () => {
  it('exposes workspace, paper, spreadsheet, sharing, and commenting tools', () => {
    const registerTool = vi.fn();
    const dispose = registerFlockdocWebMCP({
      modelContext: { registerTool },
      actions: {
        listFlockdocs: vi.fn(),
        createFlockdoc: vi.fn(),
        renameFlockdoc: vi.fn(),
        shareFlockdoc: vi.fn(),
        addComment: vi.fn(),
        updatePaper: vi.fn(),
        updateSpreadsheet: vi.fn(),
      },
    });

    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      'flockdoc.list',
      'flockdoc.create',
      'flockdoc.rename',
      'flockdoc.share',
      'flockdoc.comment',
      'paper.update',
      'spreadsheet.update',
    ]);
    dispose();
  });
});
