import type { FlockdocApi } from './api';

export type FlockdocRealtimeActor = {
  type: 'user' | 'team' | 'agent' | 'link';
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

type CommittedEventBase = RealtimeEventBase & {
  revision: number;
  idempotencyKey: string;
};

export type FlockdocCommittedEvent = CommittedEventBase & ({
  kind: 'revision.committed';
  snapshotKey: string;
} | {
  kind: 'update.committed';
  updateBase64: string;
});

export type FlockdocRealtimeEvent = FlockdocCommittedEvent | RealtimeEventBase & {
  kind: 'presence.updated';
  action: 'joined' | 'left';
  connectionId: string;
};

export interface RealtimeSocket {
  close(): void;
  addEventListener(type: string, listener: (event: Event | MessageEvent) => void): void;
}

type RealtimeClientOptions = {
  createSocket?: (url: string) => RealtimeSocket;
  retryDelayMs?: (attempt: number) => number;
  onConnected?: () => void | Promise<void>;
};

function isRealtimeEvent(value: unknown): value is FlockdocRealtimeEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<FlockdocRealtimeEvent>;
  return event.protocolVersion === 1
    && typeof event.eventId === 'string'
    && typeof event.flockdocId === 'string'
    && (event.kind === 'revision.committed' || event.kind === 'update.committed' || event.kind === 'presence.updated');
}

let pageRealtimeClientId: string | undefined;

export function getFlockdocRealtimeClientId(): string {
  pageRealtimeClientId ??= `browser_${crypto.randomUUID()}`;
  return pageRealtimeClientId;
}

export class FlockdocRealtimeClient {
  private active = false;
  private socket?: RealtimeSocket;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private readonly createSocket: (url: string) => RealtimeSocket;
  private readonly retryDelayMs: (attempt: number) => number;
  private readonly onConnected?: () => void | Promise<void>;

  constructor(
    private readonly api: FlockdocApi,
    private readonly flockdocId: string,
    private readonly clientId: string,
    private readonly onEvent: (event: FlockdocRealtimeEvent) => void | Promise<void>,
    options: RealtimeClientOptions = {},
  ) {
    this.createSocket = options.createSocket ?? (url => new WebSocket(url));
    this.retryDelayMs = options.retryDelayMs ?? (attempt => Math.min(1_000 * 2 ** attempt, 15_000));
    this.onConnected = options.onConnected;
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
      socket.addEventListener('open', () => {
        this.attempt = 0;
        Promise.resolve(this.onConnected?.()).catch(() => socket.close());
      });
      socket.addEventListener('message', event => {
        if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return;
        try {
          const parsed = JSON.parse(event.data) as unknown;
          if (isRealtimeEvent(parsed) && parsed.flockdocId === this.flockdocId) {
            Promise.resolve(this.onEvent(parsed)).catch(() => socket.close());
          }
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

type RealtimeRecoveryOptions = {
  currentRevision: () => number;
  onEvent: (event: FlockdocCommittedEvent) => void | Promise<void>;
  onSnapshotRequired: (headRevision: number) => void | Promise<void>;
  pageLimit?: number;
};

export class FlockdocRealtimeRecovery {
  private running?: Promise<void>;

  constructor(
    private readonly api: FlockdocApi,
    private readonly flockdocId: string,
    private readonly options: RealtimeRecoveryOptions,
  ) {}

  recover(): Promise<void> {
    if (this.running) return this.running;
    const operation = this.run().finally(() => {
      if (this.running === operation) this.running = undefined;
    });
    this.running = operation;
    return operation;
  }

  private async run(): Promise<void> {
    let cursor = this.options.currentRevision();
    const limit = this.options.pageLimit ?? 100;
    for (let pageCount = 0; pageCount < 1_000; pageCount++) {
      const page = await this.api.listUpdates(this.flockdocId, cursor, limit);
      if (page.requiresSnapshot) {
        await this.options.onSnapshotRequired(page.headRevision);
        return;
      }
      for (const event of page.updates) await this.options.onEvent(event);
      if (!page.page.hasMore) return;
      if (page.page.nextRevision <= cursor) throw new Error('Flockdoc recovery cursor did not advance.');
      cursor = page.page.nextRevision;
    }
    throw new Error('Flockdoc recovery exceeded the page safety limit.');
  }
}
