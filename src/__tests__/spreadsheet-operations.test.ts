import { describe, expect, it } from 'vitest';
import { decodeSpreadsheetOperation, encodeSpreadsheetOperation, initialSpreadsheetRecoveryRevision, patchesFromChangedRanges, shouldCheckpointSpreadsheet, structurePatchFromCommand } from '../lib/spreadsheet-operations';

describe('spreadsheet cell operations', () => {
  it('converts changed ranges into value, formula, and clear patches', () => {
    const patches = patchesFromChangedRanges([{
      getSheetId: () => 'sheet-1',
      getRow: () => 4,
      getColumn: () => 2,
      getValues: () => [['Forecast', 12], [null, 24]],
      getFormulas: () => [['', '=A1*2'], ['', '']],
    }]);
    expect(patches).toEqual([{
      protocolVersion: 1,
      kind: 'spreadsheet.cells.patch',
      sheetId: 'sheet-1',
      changes: [
        { row: 4, column: 2, value: 'Forecast' },
        { row: 4, column: 3, formula: '=A1*2' },
        { row: 5, column: 2, clear: true },
        { row: 5, column: 3, value: 24 },
      ],
    }]);
  });

  it('round trips canonical UTF-8 operation envelopes and rejects opaque updates', () => {
    const operation = {
      protocolVersion: 1 as const,
      kind: 'spreadsheet.cells.patch' as const,
      sheetId: '计划',
      changes: [{ row: 0, column: 0, value: '预算' }],
    };
    expect(decodeSpreadsheetOperation(encodeSpreadsheetOperation(operation))).toEqual(operation);
    expect(decodeSpreadsheetOperation('AQID')).toBeNull();
  });

  it('converts Univer row and column commands into exact-base structural patches', () => {
    expect(structurePatchFromCommand({
      id: 'sheet.command.insert-row',
      params: { subUnitId: 'sheet-1', range: { startRow: 4, endRow: 6, startColumn: 0, endColumn: 10 } },
    }, 8)).toEqual({
      protocolVersion: 1,
      kind: 'spreadsheet.structure.patch',
      baseRevision: 8,
      changes: [{ action: 'rows.insert', sheetId: 'sheet-1', index: 4, count: 3 }],
    });
    expect(structurePatchFromCommand({
      id: 'sheet.command.remove-col',
      params: { subUnitId: 'sheet-1', range: { startRow: 0, endRow: 20, startColumn: 2, endColumn: 3 } },
    }, 9)?.changes).toEqual([{ action: 'columns.delete', sheetId: 'sheet-1', index: 2, count: 2 }]);
    expect(structurePatchFromCommand({
      id: 'sheet.command.add-worksheet-merge',
      params: { subUnitId: 'sheet-1', selections: [{ startRow: 1, endRow: 2, startColumn: 3, endColumn: 5 }] },
    }, 10)?.changes).toEqual([{ action: 'range.merge', sheetId: 'sheet-1', startRow: 1, endRow: 2, startColumn: 3, endColumn: 5 }]);
  });

  it('round trips structure operations and requests periodic checkpoints', () => {
    const operation = {
      protocolVersion: 1 as const,
      kind: 'spreadsheet.structure.patch' as const,
      baseRevision: 10,
      changes: [{ action: 'sheet.rename' as const, sheetId: 'sheet-1', name: 'Forecast' }],
    };
    expect(decodeSpreadsheetOperation(encodeSpreadsheetOperation(operation))).toEqual(operation);
    expect(shouldCheckpointSpreadsheet(10, 109)).toBe(false);
    expect(shouldCheckpointSpreadsheet(10, 110)).toBe(true);
  });

  it('replays from the checkpoint revision when operations are enabled', () => {
    expect(initialSpreadsheetRecoveryRevision(4, 9, true)).toBe(4);
    expect(initialSpreadsheetRecoveryRevision(4, 9, false)).toBe(9);
  });
});
