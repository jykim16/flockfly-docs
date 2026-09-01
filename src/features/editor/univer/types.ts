export interface MountedUniverEditor {
  applySnapshot: (snapshot: unknown) => void;
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
}
