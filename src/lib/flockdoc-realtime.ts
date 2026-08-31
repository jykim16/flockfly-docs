import type { FlockdocApi } from './api';

export type FlockdocRealtimeActor = {
  type: 'user' | 'agent';
  id: string;
  displayName: string;
};

type RealtimeEventBase = {
  protocolVersion: 1;
  eventId: string;
  flockdocId: string;
  clientId: string;
  actor: FlockdocRealtimeActor;
  occurredAt: string;
};

export type FlockdocRealtimeEvent = RealtimeEventBase & ({
  kind: 'revision.committed';
  revision: number;
  snapshotKey: string;
} | {
  kind: 'presence.updated';
  action: 'joined' | 'left';
  connectionId: string;
});

export interface RealtimeSocket {
  close(): void;
  addEventListener(type: string, listener: (event: Event | MessageEvent) => void): void;
}

type RealtimeClientOptions = {
  createSocket?: (url: string) => RealtimeSocket;
  retryDelayMs?: (attempt: number) => number;
};

function isRealtimeEvent(value: unknown): value is FlockdocRealtimeEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<FlockdocRealtimeEvent>;
  return event.protocolVersion === 1
    && typeof event.eventId === 'string'
    && typeof event.flockdocId === 'string'
    && (event.kind === 'revision.committed' || event.kind === 'presence.updated');
}

export function getFlockdocRealtimeClientId(): string {
  const key = 'flockdoc.realtime.client-id';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = `browser_${crypto.randomUUID()}`;
  sessionStorage.setItem(key, created);
  return created;
}

export class FlockdocRealtimeClient {
  private active = false;
  private socket?: RealtimeSocket;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private readonly createSocket: (url: string) => RealtimeSocket;
  private readonly retryDelayMs: (attempt: number) => number;

  constructor(
    private readonly api: FlockdocApi,
    private readonly flockdocId: string,
    private readonly clientId: string,
    private readonly onEvent: (event: FlockdocRealtimeEvent) => void | Promise<void>,
    options: RealtimeClientOptions = {},
  ) {
    this.createSocket = options.createSocket ?? (url => new WebSocket(url));
    this.retryDelayMs = options.retryDelayMs ?? (attempt => Math.min(1_000 * 2 ** attempt, 15_000));
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    await this.connect();
  }

  stop(): void {
    this.active = false;
    clearTimeout(this.retryTimer);
    this.socket?.close();
    this.socket = undefined;
  }

  private async connect(): Promise<void> {
    if (!this.active) return;
    try {
      const ticket = await this.api.realtimeTicket(this.flockdocId, this.clientId);
      if (!this.active) return;
      const socket = this.createSocket(ticket.url);
      this.socket = socket;
      socket.addEventListener('open', () => { this.attempt = 0; });
      socket.addEventListener('message', event => {
        if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return;
        try {
          const parsed = JSON.parse(event.data) as unknown;
          if (isRealtimeEvent(parsed) && parsed.flockdocId === this.flockdocId) void this.onEvent(parsed);
        } catch {
          // Ignore malformed transport messages; reconnect/catch-up remains independent.
        }
      });
      socket.addEventListener('close', () => {
        if (this.socket === socket) this.socket = undefined;
        this.scheduleReconnect();
      });
      socket.addEventListener('error', () => socket.close());
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.active || this.retryTimer) return;
    const delay = this.retryDelayMs(this.attempt++);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.connect();
    }, delay);
  }
}
