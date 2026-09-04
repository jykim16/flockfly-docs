export type SpreadsheetCellValue = string | number | boolean;

export type SpreadsheetCellChange = { row: number; column: number } & (
  | { value: SpreadsheetCellValue }
  | { formula: string }
  | { clear: true }
);

export type SpreadsheetCellsPatch = {
  protocolVersion: 1;
  kind: 'spreadsheet.cells.patch';
  sheetId: string;
  changes: SpreadsheetCellChange[];
};

export type SpreadsheetStructureChange =
  | { action: 'sheet.create'; sheetId: string; name: string; index: number }
  | { action: 'sheet.delete'; sheetId: string }
  | { action: 'sheet.rename'; sheetId: string; name: string }
  | { action: 'sheet.move'; sheetId: string; index: number }
  | { action: 'range.merge' | 'range.unmerge'; sheetId: string; startRow: number; endRow: number; startColumn: number; endColumn: number }
  | { action: 'rows.insert' | 'rows.delete' | 'columns.insert' | 'columns.delete'; sheetId: string; index: number; count: number };

export type SpreadsheetStructurePatch = {
  protocolVersion: 1;
  kind: 'spreadsheet.structure.patch';
  baseRevision: number;
  changes: SpreadsheetStructureChange[];
};

export type SpreadsheetOperation = SpreadsheetCellsPatch | SpreadsheetStructurePatch;

export interface SpreadsheetChangedRange {
  getSheetId(): string;
  getRow(): number;
  getColumn(): number;
  getValues(): unknown[][];
  getFormulas(): string[][];
}

export function patchesFromChangedRanges(ranges: SpreadsheetChangedRange[]): SpreadsheetCellsPatch[] {
  const grouped = new Map<string, Map<string, SpreadsheetCellChange>>();
  for (const range of ranges) {
    const sheetId = range.getSheetId();
    const changes = grouped.get(sheetId) ?? new Map<string, SpreadsheetCellChange>();
    const values = range.getValues();
    const formulas = range.getFormulas();
    values.forEach((rowValues, rowOffset) => rowValues.forEach((value, columnOffset) => {
      const row = range.getRow() + rowOffset;
      const column = range.getColumn() + columnOffset;
      const formula = formulas[rowOffset]?.[columnOffset];
      const change: SpreadsheetCellChange | undefined = formula
        ? { row, column, formula }
        : value == null
          ? { row, column, clear: true }
          : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? { row, column, value }
            : undefined;
      if (!change) return;
      changes.set(`${row}:${column}`, change);
    }));
    grouped.set(sheetId, changes);
  }
  return [...grouped].map(([sheetId, changes]) => ({
    protocolVersion: 1,
    kind: 'spreadsheet.cells.patch',
    sheetId,
    changes: [...changes.values()],
  }));
}

export function encodeSpreadsheetOperation(operation: SpreadsheetOperation): string {
  const bytes = new TextEncoder().encode(JSON.stringify(operation));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeSpreadsheetOperation(updateBase64: string): SpreadsheetOperation | null {
  try {
    const binary = atob(updateBase64);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SpreadsheetOperation>;
    if (parsed.protocolVersion !== 1 || !Array.isArray(parsed.changes)) return null;
    if (parsed.kind === 'spreadsheet.cells.patch' && typeof parsed.sheetId === 'string') return parsed as SpreadsheetCellsPatch;
    if (parsed.kind === 'spreadsheet.structure.patch' && Number.isSafeInteger(parsed.baseRevision)) return parsed as SpreadsheetStructurePatch;
    return null;
  } catch {
    return null;
  }
}

export const encodeSpreadsheetCellsPatch = encodeSpreadsheetOperation;
export const decodeSpreadsheetCellsPatch = decodeSpreadsheetOperation;

type UniverStructureCommand = {
  id: string;
  params?: {
    subUnitId?: unknown;
    range?: { startRow?: unknown; endRow?: unknown; startColumn?: unknown; endColumn?: unknown };
    selections?: Array<{ startRow?: unknown; endRow?: unknown; startColumn?: unknown; endColumn?: unknown }>;
    ranges?: Array<{ startRow?: unknown; endRow?: unknown; startColumn?: unknown; endColumn?: unknown }>;
  };
};

type UniverPresentationCommand = {
  id: string;
  params?: { cellValue?: unknown };
};

const PRESENTATION_COMMAND_IDS = new Set([
  'sheet.command.set-style',
  'sheet.command.set-border',
  'sheet.command.set-border-basic',
  'sheet.command.set-worksheet-range-theme-style',
  'sheet.command.set-worksheet-default-style',
  'sheet.command.set-gridlines-color',
  'sheet.command.set-tab-color',
  'sheet.command.delta-column-width',
  'sheet.command.set-worksheet-col-width',
  'sheet.command.set-col-is-auto-width',
  'sheet.command.set-col-auto-width',
  'sheet.command.delta-row-height',
  'sheet.command.set-row-height',
  'sheet.command.set-row-is-auto-height',
]);

function containsCellStyle(cellValue: unknown): boolean {
  if (!cellValue || typeof cellValue !== 'object' || Array.isArray(cellValue)) return false;
  return Object.values(cellValue).some(row => row && typeof row === 'object' && !Array.isArray(row)
    && Object.values(row).some(cell => cell && typeof cell === 'object' && !Array.isArray(cell) && Object.hasOwn(cell, 's')));
}

export function isSpreadsheetPresentationCommand(command: UniverPresentationCommand): boolean {
  if (PRESENTATION_COMMAND_IDS.has(command.id)) return true;
  if (command.id === 'sheet.mutation.set-row-data' || command.id === 'sheet.mutation.set-col-data') return true;
  return command.id === 'sheet.mutation.set-range-values' && containsCellStyle(command.params?.cellValue);
}

export function structurePatchFromCommand(command: UniverStructureCommand, baseRevision: number): SpreadsheetStructurePatch | null {
  const params = command.params;
  if (typeof params?.subUnitId === 'string' && (command.id === 'sheet.command.add-worksheet-merge' || command.id === 'sheet.command.remove-worksheet-merge')) {
    const ranges = command.id === 'sheet.command.add-worksheet-merge' ? params.selections : params.ranges;
    if (!ranges?.length) return null;
    const changes: SpreadsheetStructureChange[] = [];
    for (const range of ranges) {
      const values = [range.startRow, range.endRow, range.startColumn, range.endColumn];
      if (!values.every(value => Number.isSafeInteger(value) && Number(value) >= 0)) return null;
      changes.push({
        action: command.id === 'sheet.command.add-worksheet-merge' ? 'range.merge' : 'range.unmerge',
        sheetId: params.subUnitId,
        startRow: Number(range.startRow), endRow: Number(range.endRow),
        startColumn: Number(range.startColumn), endColumn: Number(range.endColumn),
      });
    }
    return { protocolVersion: 1, kind: 'spreadsheet.structure.patch', baseRevision, changes };
  }
  const range = params?.range;
  if (typeof params?.subUnitId !== 'string' || !range) return null;
  const mappings = {
    'sheet.command.insert-row': ['rows.insert', range.startRow, range.endRow],
    'sheet.command.remove-row': ['rows.delete', range.startRow, range.endRow],
    'sheet.command.insert-col': ['columns.insert', range.startColumn, range.endColumn],
    'sheet.command.remove-col': ['columns.delete', range.startColumn, range.endColumn],
  } as const;
  const mapping = mappings[command.id as keyof typeof mappings];
  if (!mapping) return null;
  const [action, start, end] = mapping;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || Number(start) < 0 || Number(end) < Number(start)) return null;
  return {
    protocolVersion: 1,
    kind: 'spreadsheet.structure.patch',
    baseRevision,
    changes: [{ action, sheetId: params.subUnitId, index: Number(start), count: Number(end) - Number(start) + 1 }],
  };
}

export function shouldCheckpointSpreadsheet(snapshotRevision: number, headRevision: number, threshold = 100): boolean {
  return headRevision - snapshotRevision >= threshold;
}
