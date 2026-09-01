import type { SpreadsheetCellsPatch } from '../../../lib/spreadsheet-operations';

export interface MountedUniverEditor {
  applySnapshot: (snapshot: unknown) => void;
  applySpreadsheetOperation?: (operation: SpreadsheetCellsPatch) => void;
  dispose: () => void;
}

export interface MountUniverEditorOptions {
  host: HTMLDivElement;
  id: string;
  name: string;
  snapshot?: unknown;
  canEdit?: boolean;
  onSnapshot: (snapshot: unknown) => void;
  onDirty?: () => void;
  onSpreadsheetOperation?: (operation: SpreadsheetCellsPatch) => void | Promise<void>;
}
