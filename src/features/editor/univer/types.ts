import type { SpreadsheetOperation } from '../../../lib/spreadsheet-operations';
import type { PaperTextPatch } from '../../../lib/paper-collaboration';

export interface MountedUniverEditor {
  applySnapshot: (snapshot: unknown) => void;
  applySpreadsheetOperation?: (operation: SpreadsheetOperation) => void;
  applyPaperPatch?: (patch: PaperTextPatch) => void;
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
  onPaperSnapshotChange?: (snapshot: unknown) => void | Promise<void>;
  getSpreadsheetRevision?: () => number;
}
