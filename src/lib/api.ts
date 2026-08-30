import type { Comment, Flockdoc, FlockdocPermissions, FlockdocRole, FlockdocType } from '../types';

const TOKEN_KEY = 'flockfly.token';
const API_URL = import.meta.env.VITE_FLOCKFLY_API_URL ?? '';
const PLATFORM_URL = import.meta.env.PROD ? 'https://platform.flockfly.ai' : location.origin;

export function supportsPlatformSession(): boolean {
  return !import.meta.env.PROD || location.origin === PLATFORM_URL;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; currentRevision?: number };
}

interface BackendFlockdoc {
  id: string;
  type: FlockdocType;
  name: string;
  updatedAt?: string;
  headRevision?: number;
  role?: FlockdocRole;
  permissions?: FlockdocPermissions;
}

export interface FlockdocState {
  flockdoc: Flockdoc;
  revision: number;
  snapshot: Record<string, unknown> | null;
}

export interface PlatformSession {
  user: { email: string };
  billing?: { entitled?: boolean };
}

export class FlockdocApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'FlockdocApiError';
  }
}

export class RevisionConflictError extends FlockdocApiError {
  constructor(public readonly currentRevision: number) {
    super(409, 'revision_conflict', 'A newer flockdoc revision exists.');
    this.name = 'RevisionConflictError';
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function consumeAuthTokenFromHash(hash: string): string | null {
  if (!hash.startsWith('#/auth')) return null;
  const token = new URLSearchParams(hash.split('?')[1] ?? '').get('token');
  if (!token) return null;
  setToken(token);
  return token;
}

export function googleSignInUrl(): string {
  const returnTo = import.meta.env.PROD ? `${PLATFORM_URL}/flockdoc/` : `${location.origin}${import.meta.env.BASE_URL}`;
  return `${PLATFORM_URL}/v1/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
}

function mapFlockdoc(flockdoc: BackendFlockdoc): Flockdoc {
  return {
    id: flockdoc.id,
    name: flockdoc.name,
    type: flockdoc.type,
    modifiedAt: flockdoc.updatedAt ?? 'Just now',
    collaborators: [],
    headRevision: flockdoc.headRevision ?? 0,
    role: flockdoc.role,
    permissions: flockdoc.permissions,
  };
}

export class FlockdocApi {
  constructor(private readonly token?: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...init?.headers,
      },
    });
    const text = await response.text();
    let parsed: T & ApiErrorBody | null = null;
    try { parsed = text ? JSON.parse(text) as T & ApiErrorBody : null; } catch { parsed = null; }
    if (!response.ok) {
      const error = (parsed as ApiErrorBody)?.error;
      if (response.status === 409 && error?.code === 'revision_conflict') {
        throw new RevisionConflictError(Number(error.currentRevision));
      }
      throw new FlockdocApiError(response.status, error?.code ?? 'unknown', error?.message ?? `Flockdoc API ${response.status}`);
    }
    return parsed as T;
  }

  session() {
    return this.request<PlatformSession>('/v1/me');
  }

  async list(): Promise<{ flockdocs: Flockdoc[] }> {
    const response = await this.request<{ flockdocs: BackendFlockdoc[] }>('/v1/flockdocs');
    return { flockdocs: response.flockdocs.map(mapFlockdoc) };
  }

  async create(name: string, type: FlockdocType): Promise<{ flockdoc: Flockdoc }> {
    const response = await this.request<{ flockdoc: BackendFlockdoc }>('/v1/flockdocs', {
      method: 'POST', body: JSON.stringify({ name, type }),
    });
    return { flockdoc: mapFlockdoc(response.flockdoc) };
  }

  async rename(id: string, name: string): Promise<{ flockdoc: Flockdoc }> {
    const response = await this.request<{ flockdoc: BackendFlockdoc }>(`/v1/flockdocs/${id}`, {
      method: 'PATCH', body: JSON.stringify({ name }),
    });
    return { flockdoc: mapFlockdoc(response.flockdoc) };
  }

  async getState(id: string): Promise<FlockdocState> {
    const response = await this.request<{ flockdoc: BackendFlockdoc; revision: number; snapshot: Record<string, unknown> | null }>(`/v1/flockdocs/${id}/state`);
    return { ...response, flockdoc: mapFlockdoc(response.flockdoc) };
  }

  saveState(id: string, baseRevision: number, idempotencyKey: string, snapshot: unknown) {
    return this.request<{ revision: number; snapshotKey: string; duplicate: boolean }>(`/v1/flockdocs/${id}/state`, {
      method: 'PUT', body: JSON.stringify({ baseRevision, idempotencyKey, snapshot }),
    });
  }

  addComment(id: string, body: string, anchor?: unknown) {
    return this.request<{ comment: Comment }>(`/v1/flockdocs/${id}/comments`, { method: 'POST', body: JSON.stringify({ body, anchor: anchor ?? { kind: 'document' } }) });
  }

  grantRole(id: string, principalType: string, principalId: string, role: string) {
    return this.request<void>(`/v1/flockdocs/${id}/access`, { method: 'POST', body: JSON.stringify({ principalType, principalId, role }) });
  }
}
