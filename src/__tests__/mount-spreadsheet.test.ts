import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSpreadsheet } from '../features/editor/univer/mount-spreadsheet';

const univerState = vi.hoisted(() => ({
  commandListener: undefined as ((command: { id: string; params?: unknown }) => void) | undefined,
}));

vi.mock('@univerjs/core', () => ({
  getSheetsEmptySnapshot: vi.fn(() => ({})),
  LocaleType: { EN_US: 'en-US' },
  mergeLocales: vi.fn(() => ({})),
}));

vi.mock('@univerjs/preset-sheets-core', () => ({ UniverSheetsCorePreset: vi.fn(() => ({})) }));
vi.mock('@univerjs/preset-sheets-core/locales/en-US', () => ({ default: {} }));
vi.mock('../lib/univer-webmcp', () => ({ registerUniverWebMCP: vi.fn(() => vi.fn()) }));

vi.mock('@univerjs/presets', () => ({
  createUniver: vi.fn(() => {
    const rangeCoordinates = { startRow: 26, endRow: 26, startColumn: 5, endColumn: 9 };
    const range = {
      merge: vi.fn(() => {
        queueMicrotask(() => univerState.commandListener?.({
          id: 'sheet.command.add-worksheet-merge',
          params: { subUnitId: 'sheet-1', selections: [rangeCoordinates] },
        }));
        return range;
      }),
      breakApart: vi.fn(() => range),
    };
    const sheet = { getRange: vi.fn(() => range) };
    const workbook = {
      getId: vi.fn(() => 'flockdoc-1'),
      getSheetBySheetId: vi.fn(() => sheet),
      onCommandExecuted: vi.fn((listener: typeof univerState.commandListener) => {
        univerState.commandListener = listener;
        return { dispose: vi.fn() };
      }),
      save: vi.fn(() => ({})),
    };
    const univerAPI = {
      Event: {
        SheetValueChanged: 'SheetValueChanged',
        SheetCreated: 'SheetCreated',
        SheetDeleted: 'SheetDeleted',
        SheetNameChanged: 'SheetNameChanged',
        SheetMoved: 'SheetMoved',
      },
      addEvent: vi.fn(() => ({ dispose: vi.fn() })),
      createWorkbook: vi.fn(() => workbook),
      disposeUnit: vi.fn(),
    };
    return { univer: { dispose: vi.fn() }, univerAPI };
  }),
}));

describe('mounted spreadsheet collaboration', () => {
  afterEach(() => {
    univerState.commandListener = undefined;
    vi.clearAllMocks();
  });

  it('does not echo a remotely applied merge when Univer reports its command asynchronously', async () => {
    const onSpreadsheetOperation = vi.fn();
    const mounted = mountSpreadsheet({
      host: document.createElement('div'),
      id: 'flockdoc-1',
      name: 'Plan',
      snapshot: {},
      onSnapshot: vi.fn(),
      onSpreadsheetOperation,
      getSpreadsheetRevision: () => 7688,
    });

    mounted.applySpreadsheetOperation?.({
      protocolVersion: 1,
      kind: 'spreadsheet.structure.patch',
      baseRevision: 7687,
      changes: [{
        action: 'range.merge',
        sheetId: 'sheet-1',
        startRow: 26,
        endRow: 26,
        startColumn: 5,
        endColumn: 9,
      }],
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onSpreadsheetOperation).not.toHaveBeenCalled();

    univerState.commandListener?.({
      id: 'sheet.command.add-worksheet-merge',
      params: {
        subUnitId: 'sheet-1',
        selections: [{ startRow: 26, endRow: 26, startColumn: 5, endColumn: 9 }],
      },
    });

    expect(onSpreadsheetOperation).toHaveBeenCalledOnce();
    expect(onSpreadsheetOperation.mock.calls[0][0]).toMatchObject({
      kind: 'spreadsheet.structure.patch',
      baseRevision: 7688,
      changes: [{ action: 'range.merge', sheetId: 'sheet-1' }],
    });
    mounted.dispose();
  });
});
