import type { FlockdocState } from './api';
import type { FlockdocRealtimeEvent } from './flockdoc-realtime';

type RemoteSnapshotSynchronizerOptions = {
  clientId: string;
  currentRevision: () => number;
  hasUnsavedChanges: () => boolean;
  load: () => Promise<FlockdocState>;
  apply: (state: FlockdocState) => void;
  blocked?: (revision: number) => void;
};

export class RemoteSnapshotSynchronizer {
  constructor(private readonly options: RemoteSnapshotSynchronizerOptions) {}

  async handle(event: FlockdocRealtimeEvent): Promise<'applied' | 'blocked' | 'ignored'> {
    if (event.kind !== 'revision.committed'
      || event.clientId === this.options.clientId
      || event.revision <= this.options.currentRevision()) return 'ignored';
    return this.refresh(event.revision);
  }

  async refresh(targetRevision: number): Promise<'applied' | 'blocked' | 'ignored'> {
    if (targetRevision <= this.options.currentRevision()) return 'ignored';
    if (this.options.hasUnsavedChanges()) {
      this.options.blocked?.(targetRevision);
      return 'blocked';
    }
    const state = await this.options.load();
    if (state.snapshotRevision < targetRevision || state.revision <= this.options.currentRevision()) return 'ignored';
    this.options.apply(state);
    return 'applied';
  }
}
