export interface MountedUniverEditor {
  dispose: () => void;
}

export interface MountUniverEditorOptions {
  host: HTMLDivElement;
  id: string;
  name: string;
  snapshot?: unknown;
  onSnapshot: (snapshot: unknown) => void;
}
