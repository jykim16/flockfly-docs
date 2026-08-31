import { describe, expect, it, vi } from 'vitest';
import type { FlockdocApi, FlockdocState } from '../lib/api';
import { FlockdocRealtimeClient, type FlockdocRealtimeEvent, type RealtimeSocket } from '../lib/flockdoc-realtime';
import { RemoteSnapshotSynchronizer } from '../lib/realtime-snapshot-sync';

class FakeSocket implements RealtimeSocket {
  readonly listeners = new Map<string, Set<(event: Event | MessageEvent) => void>>();
  close = vi.fn();
  addEventListener(type: string, listener: (event: Event | MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  emit(type: string, event: Event | MessageEvent = new Event(type)) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const revisionEvent: FlockdocRealtimeEvent = {
  protocolVersion: 1,
  eventId: 'event_1',
  kind: 'revision.committed',
  flockdocId: 'flockdoc_1',
  revision: 4,
  snapshotKey: 'snapshot_4',
  clientId: 'browser_2',
  actor: { type: 'user', id: 'user_2', displayName: 'Teammate' },
  occurredAt: '2026-08-31T00:00:00.000Z',
};

describe('flockdoc realtime client', () => {
  it('connects with a scoped ticket and delivers typed events', async () => {
    const socket = new FakeSocket();
    const api = { realtimeTicket: vi.fn().mockResolvedValue({ url: 'wss://api.example/realtime?ticket=abc', expiresInSeconds: 60 }) } as unknown as FlockdocApi;
    const received: FlockdocRealtimeEvent[] = [];
    const client = new FlockdocRealtimeClient(api, 'flockdoc_1', 'browser_1', event => received.push(event), {
      createSocket: vi.fn().mockReturnValue(socket),
    });

    await client.start();
    socket.emit('message', new MessageEvent('message', { data: JSON.stringify(revisionEvent) }));
    expect(api.realtimeTicket).toHaveBeenCalledWith('flockdoc_1', 'browser_1');
    expect(received).toEqual([revisionEvent]);
    client.stop();
    expect(socket.close).toHaveBeenCalled();
  });

  it('reconnects with a fresh ticket after an unexpected close', async () => {
    vi.useFakeTimers();
    const first = new FakeSocket();
    const sockets = [first, new FakeSocket()];
    const api = { realtimeTicket: vi.fn().mockResolvedValue({ url: 'wss://api.example/realtime?ticket=abc', expiresInSeconds: 60 }) } as unknown as FlockdocApi;
    const client = new FlockdocRealtimeClient(api, 'flockdoc_1', 'browser_1', vi.fn(), {
      createSocket: () => sockets.shift()!,
      retryDelayMs: () => 10,
    });
    await client.start();
    first.emit('close');
    await vi.advanceTimersByTimeAsync(10);
    expect(api.realtimeTicket).toHaveBeenCalledTimes(2);
    client.stop();
    vi.useRealTimers();
  });
});

describe('remote snapshot synchronization', () => {
  const state = { revision: 4, snapshot: { value: 'remote' }, flockdoc: { id: 'flockdoc_1' } } as FlockdocState;

  it('loads a newer remote snapshot when local state is clean', async () => {
    const apply = vi.fn();
    const sync = new RemoteSnapshotSynchronizer({
      clientId: 'browser_1',
      currentRevision: () => 3,
      hasUnsavedChanges: () => false,
      load: vi.fn().mockResolvedValue(state),
      apply,
    });
    await expect(sync.handle(revisionEvent)).resolves.toBe('applied');
    expect(apply).toHaveBeenCalledWith(state);
  });

  it('protects unsaved local state and ignores the local client echo', async () => {
    const load = vi.fn().mockResolvedValue(state);
    const blocked = vi.fn();
    const sync = new RemoteSnapshotSynchronizer({
      clientId: 'browser_1',
      currentRevision: () => 3,
      hasUnsavedChanges: () => true,
      load,
      apply: vi.fn(),
      blocked,
    });
    await expect(sync.handle(revisionEvent)).resolves.toBe('blocked');
    await expect(sync.handle({ ...revisionEvent, clientId: 'browser_1' })).resolves.toBe('ignored');
    expect(load).not.toHaveBeenCalled();
    expect(blocked).toHaveBeenCalledWith(4);
  });
});
