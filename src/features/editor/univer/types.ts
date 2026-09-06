import type { SpreadsheetOperation } from '../../../lib/spreadsheet-operations';
import type { PaperTextPatch } from '../../../lib/paper-collaboration';
import type { PresentationSnapshot } from '../../../lib/presentation-operations';

export interface MountedUniverEditor {
  applySnapshot: (snapshot: unknown) => void;
  applySpreadsheetOperation?: (operation: SpreadsheetOperation) => void;
  applyPaperPatch?: (patch: PaperTextPatch) => void;
  applyPresentationSnapshot?: (snapshot: PresentationSnapshot) => void;
  getSnapshot?: () => unknown;
  dispose: () => void;
}

export interface MountUniverEditorOptions {
  host: HTMLDivElement;
  id: string;
  name: string;
  snapshot?: unknown;
  canEdit?: boolean;
  onSnapshot: (snapshot: unknown) => void | Promise<void>;
  onDirty?: () => void;
  onSpreadsheetOperation?: (operation: SpreadsheetOperation) => void | Promise<void>;
  onPaperSnapshotChange?: (snapshot: unknown) => void | Promise<void>;
  onPresentationSnapshotChange?: (snapshot: PresentationSnapshot) => void | Promise<void>;
  getSpreadsheetRevision?: () => number;
}
