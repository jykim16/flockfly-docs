import type { SpreadsheetOperation } from '../../../lib/spreadsheet-operations';

export interface MountedUniverEditor {
  applySnapshot: (snapshot: unknown) => void;
  applySpreadsheetOperation?: (operation: SpreadsheetOperation) => void;
  getSnapshot?: () => unknown;
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
  onSpreadsheetOperation?: (operation: SpreadsheetOperation) => void | Promise<void>;
  getSpreadsheetRevision?: () => number;
}
