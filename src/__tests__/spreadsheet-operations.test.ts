import { describe, expect, it } from 'vitest';
import { decodeSpreadsheetCellsPatch, encodeSpreadsheetCellsPatch, initialSpreadsheetRecoveryRevision, patchesFromChangedRanges } from '../lib/spreadsheet-operations';

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
    expect(decodeSpreadsheetCellsPatch(encodeSpreadsheetCellsPatch(operation))).toEqual(operation);
    expect(decodeSpreadsheetCellsPatch('AQID')).toBeNull();
  });

  it('replays from the checkpoint revision when operations are enabled', () => {
    expect(initialSpreadsheetRecoveryRevision(4, 9, true)).toBe(4);
    expect(initialSpreadsheetRecoveryRevision(4, 9, false)).toBe(9);
  });
});
