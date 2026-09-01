import { describe, expect, it, vi } from 'vitest';
import type { FlockdocApi } from '../lib/api';
import { FlockdocRealtimeClient, FlockdocRealtimeRecovery, getFlockdocRealtimeClientId, type FlockdocRealtimeEvent, type RealtimeSocket } from '../lib/flockdoc-realtime';

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
  idempotencyKey: 'snapshot-4',
  snapshotKey: 'snapshot_4',
  clientId: 'browser_2',
  actor: { type: 'user', id: 'user_2', displayName: 'Teammate' },
  occurredAt: '2026-08-31T00:00:00.000Z',
};

describe('flockdoc realtime client', () => {
  it('uses a page-scoped identity instead of a sessionStorage value copied from another tab', () => {
    sessionStorage.setItem('flockdoc.realtime.client-id', 'browser_copied_from_opener');

    const first = getFlockdocRealtimeClientId();

    expect(first).toMatch(/^browser_/);
    expect(first).not.toBe('browser_copied_from_opener');
    expect(getFlockdocRealtimeClientId()).toBe(first);
  });

  it('connects with a scoped ticket and delivers typed events', async () => {
    const socket = new FakeSocket();
    const api = { realtimeTicket: vi.fn().mockResolvedValue({ url: 'wss://api.example/realtime?ticket=abc', expiresInSeconds: 60 }) } as unknown as FlockdocApi;
    const received: FlockdocRealtimeEvent[] = [];
    const client = new FlockdocRealtimeClient(api, 'flockdoc_1', 'browser_1', event => { received.push(event); }, {
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

  it('runs durable recovery after every socket open', async () => {
    vi.useFakeTimers();
    const first = new FakeSocket();
    const second = new FakeSocket();
    const sockets = [first, second];
    const recovered = vi.fn();
    const api = { realtimeTicket: vi.fn().mockResolvedValue({ url: 'wss://api.example/realtime?ticket=abc', expiresInSeconds: 60 }) } as unknown as FlockdocApi;
    const client = new FlockdocRealtimeClient(api, 'flockdoc_1', 'browser_1', vi.fn(), {
      createSocket: () => sockets.shift()!,
      retryDelayMs: () => 10,
      onConnected: recovered,
    });
    await client.start();
    first.emit('open');
    expect(recovered).toHaveBeenCalledTimes(1);
    first.emit('close');
    await vi.advanceTimersByTimeAsync(10);
    second.emit('open');
    expect(recovered).toHaveBeenCalledTimes(2);
    client.stop();
    vi.useRealTimers();
  });
});

describe('durable realtime recovery', () => {
  const updateEvent: FlockdocRealtimeEvent = {
    protocolVersion: 1,
    eventId: 'flockdoc_1:revision:3',
    kind: 'update.committed',
    flockdocId: 'flockdoc_1',
    revision: 3,
    idempotencyKey: 'update-3',
    updateBase64: 'AQID',
    clientId: 'agent_1',
    actor: { type: 'agent', id: 'agent_1', displayName: 'Planner' },
    occurredAt: '2026-08-31T00:00:01.000Z',
  };

  it('replays every durable page in revision order', async () => {
    const api = { listUpdates: vi.fn()
      .mockResolvedValueOnce({
        updates: [{ ...revisionEvent, revision: 2, idempotencyKey: 'snapshot-2' }, updateEvent],
        headRevision: 4,
        retainedFromRevision: 1,
        requiresSnapshot: false,
        page: { limit: 2, hasMore: true, nextRevision: 3 },
      })
      .mockResolvedValueOnce({
        updates: [{ ...revisionEvent, revision: 4 }],
        headRevision: 4,
        retainedFromRevision: 1,
        requiresSnapshot: false,
        page: { limit: 2, hasMore: false, nextRevision: 4 },
      }) } as unknown as FlockdocApi;
    const replayed: number[] = [];
    const recovery = new FlockdocRealtimeRecovery(api, 'flockdoc_1', {
      currentRevision: () => 1,
      onEvent: event => { replayed.push(event.revision); },
      onSnapshotRequired: vi.fn(),
      pageLimit: 2,
    });

    await recovery.recover();
    expect(api.listUpdates).toHaveBeenNthCalledWith(1, 'flockdoc_1', 1, 2);
    expect(api.listUpdates).toHaveBeenNthCalledWith(2, 'flockdoc_1', 3, 2);
    expect(replayed).toEqual([2, 3, 4]);
  });

  it('loads an authoritative snapshot instead of replaying across a retention gap', async () => {
    const fallback = vi.fn();
    const api = { listUpdates: vi.fn().mockResolvedValue({
      updates: [],
      headRevision: 8,
      retainedFromRevision: 7,
      requiresSnapshot: true,
      page: { limit: 100, hasMore: false, nextRevision: 2 },
    }) } as unknown as FlockdocApi;
    const recovery = new FlockdocRealtimeRecovery(api, 'flockdoc_1', {
      currentRevision: () => 2,
      onEvent: vi.fn(),
      onSnapshotRequired: fallback,
    });
    await recovery.recover();
    expect(fallback).toHaveBeenCalledWith(8);
  });
});
