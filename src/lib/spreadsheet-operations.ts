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

export function encodeSpreadsheetCellsPatch(operation: SpreadsheetCellsPatch): string {
  const bytes = new TextEncoder().encode(JSON.stringify(operation));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeSpreadsheetCellsPatch(updateBase64: string): SpreadsheetCellsPatch | null {
  try {
    const binary = atob(updateBase64);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SpreadsheetCellsPatch>;
    if (parsed.protocolVersion !== 1 || parsed.kind !== 'spreadsheet.cells.patch'
      || typeof parsed.sheetId !== 'string' || !Array.isArray(parsed.changes)) return null;
    return parsed as SpreadsheetCellsPatch;
  } catch {
    return null;
  }
}

export function spreadsheetOperationsEnabled(): boolean {
  return import.meta.env.VITE_FLOCKDOC_SPREADSHEET_OPERATIONS === 'true';
}

export function initialSpreadsheetRecoveryRevision(snapshotRevision: number, headRevision: number, enabled: boolean): number {
  return enabled ? snapshotRevision : headRevision;
}
