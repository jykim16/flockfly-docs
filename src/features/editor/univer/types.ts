export interface MountedUniverEditor {
  dispose: () => void;
}

export interface MountUniverEditorOptions {
  host: HTMLDivElement;
  id: string;
  name: string;
  snapshot?: unknown;
  canEdit?: boolean;
  onSnapshot: (snapshot: unknown) => void;
}
