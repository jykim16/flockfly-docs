import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPaper } from '../features/editor/univer/mount-paper';

const univerState = vi.hoisted(() => ({
  documents: [] as Array<{
    getId: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    getTextRange: ReturnType<typeof vi.fn>;
    insertText: ReturnType<typeof vi.fn>;
  }>,
  selectionInfo: undefined as undefined | {
    textRanges: Array<Record<string, unknown>>;
    isEditing: boolean;
    options?: Record<string, boolean>;
  },
  replaceDocRanges: vi.fn(),
}));

vi.mock('@univerjs/core', () => ({
  DocumentFlavor: { TRADITIONAL: 2 },
  getDocsEmptySnapshot: vi.fn(() => ({ id: 'paper-1', body: { dataStream: '\r\n' } })),
  LocaleType: { EN_US: 'en-US' },
  mergeLocales: vi.fn(() => ({})),
}));
vi.mock('@univerjs/docs', () => ({
  DOC_SELECTION_OPTION_PRESERVE_CARET: 'preserveCaret',
  DocSelectionManagerService: class DocSelectionManagerService {},
}));
vi.mock('@univerjs/preset-docs-core', () => ({ UniverDocsCorePreset: vi.fn(() => ({})) }));
vi.mock('@univerjs/preset-docs-core/locales/en-US', () => ({ default: {} }));
vi.mock('@univerjs/presets', () => ({
  createUniver: vi.fn(() => {
    const selectionManager = {
      getSelectionInfo: vi.fn(() => univerState.selectionInfo),
      replaceDocRanges: univerState.replaceDocRanges,
    };
    const univerAPI = {
      Event: { CommandExecuted: 'CommandExecuted' },
      addEvent: vi.fn(() => ({ dispose: vi.fn() })),
      createDocument: vi.fn((snapshot: { id?: string; body?: { dataStream?: string } }) => {
        const document = {
          getId: vi.fn(() => snapshot.id ?? 'paper-1'),
          save: vi.fn(() => snapshot),
          getTextRange: vi.fn(() => ({ setText: vi.fn() })),
          insertText: vi.fn(),
        };
        univerState.documents.push(document);
        return document;
      }),
      disposeUnit: vi.fn(),
    };
    return {
      univer: { __getInjector: () => ({ get: () => selectionManager }), dispose: vi.fn() },
      univerAPI,
    };
  }),
}));

describe('mounted Paper selection preservation', () => {
  afterEach(() => {
    univerState.documents = [];
    univerState.selectionInfo = undefined;
    univerState.replaceDocRanges.mockReset();
    vi.clearAllMocks();
  });

  it('restores the receiving session caret after an authoritative snapshot replacement', () => {
    univerState.selectionInfo = {
      textRanges: [{ startOffset: 7, endOffset: 7, segmentId: '', segmentPage: -1, rangeType: 0, isActive: true }],
      isEditing: true,
      options: {},
    };
    const mounted = mountPaper({
      host: document.createElement('div'),
      id: 'paper-1',
      name: 'Plan',
      snapshot: { id: 'paper-1', body: { dataStream: 'hello world\r\n' } },
      onSnapshot: vi.fn(),
    });

    mounted.applySnapshot({ id: 'paper-1', body: { dataStream: 'hello brave world\r\n' } });

    expect(univerState.replaceDocRanges).toHaveBeenCalledWith(
      [{ startOffset: 7, endOffset: 7, segmentId: '', segmentPage: -1, rangeType: 0 }],
      { unitId: 'paper-1', subUnitId: 'paper-1' },
      true,
      { preserveCaret: true },
    );
    mounted.dispose();
  });

  it('preserves a range and clamps it when the replacement document is shorter', () => {
    univerState.selectionInfo = {
      textRanges: [{ startOffset: 8, endOffset: 11, segmentId: '', segmentPage: -1, rangeType: 0, isActive: true }],
      isEditing: true,
    };
    const mounted = mountPaper({
      host: document.createElement('div'),
      id: 'paper-1',
      name: 'Plan',
      snapshot: { id: 'paper-1', body: { dataStream: 'hello world\r\n' } },
      onSnapshot: vi.fn(),
    });

    mounted.applySnapshot({ id: 'paper-1', body: { dataStream: 'short\r\n' } });

    expect(univerState.replaceDocRanges).toHaveBeenCalledWith(
      [{ startOffset: 5, endOffset: 5, segmentId: '', segmentPage: -1, rangeType: 0 }],
      { unitId: 'paper-1', subUnitId: 'paper-1' },
      true,
      { preserveCaret: true },
    );
    mounted.dispose();
  });
});
