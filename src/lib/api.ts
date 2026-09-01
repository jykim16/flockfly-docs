import type { Flockdoc, FlockdocAccessGrant, FlockdocAssignableRole, FlockdocInvitation, FlockdocLinkRole, FlockdocMember, FlockdocPermissions, FlockdocPrincipalType, FlockdocRole, FlockdocShareLink, FlockdocType, FlockdocVisibility } from '../types';
import type { FlockdocCommittedEvent } from './flockdoc-realtime';
import type { SpreadsheetOperation } from './spreadsheet-operations';

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
  prefix?: string;
  headRevision?: number;
  role?: FlockdocRole;
  permissions?: FlockdocPermissions;
  visibility?: FlockdocVisibility;
}

export interface FlockdocState {
  flockdoc: Flockdoc;
  revision: number;
  snapshotRevision: number;
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
  const returnPath = location.pathname.startsWith('/flockdoc/') ? `${location.pathname}${location.search}` : '/flockdoc/';
  const returnTo = `${import.meta.env.PROD ? PLATFORM_URL : location.origin}${returnPath}`;
  return `${PLATFORM_URL}/v1/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
}

function mapFlockdoc(flockdoc: BackendFlockdoc): Flockdoc {
  return {
    id: flockdoc.id,
    name: flockdoc.name,
    type: flockdoc.type,
    modifiedAt: flockdoc.updatedAt ?? 'Just now',
    prefix: flockdoc.prefix ?? '',
    visibility: flockdoc.visibility ?? 'private',
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

  async create(name: string, type: FlockdocType, prefix = ''): Promise<{ flockdoc: Flockdoc }> {
    const response = await this.request<{ flockdoc: BackendFlockdoc }>('/v1/flockdocs', {
      method: 'POST', body: JSON.stringify({ name, type, prefix }),
    });
    return { flockdoc: mapFlockdoc(response.flockdoc) };
  }

  async move(id: string, prefix: string): Promise<{ flockdoc: Flockdoc }> {
    const response = await this.request<{ flockdoc: BackendFlockdoc }>(`/v1/flockdocs/${id}`, {
      method: 'PATCH', body: JSON.stringify({ prefix }),
    });
    return { flockdoc: mapFlockdoc(response.flockdoc) };
  }

  async trash(id: string): Promise<void> {
    await this.request<void>(`/v1/flockdocs/${id}`, { method: 'DELETE' });
  }

  async rename(id: string, name: string): Promise<{ flockdoc: Flockdoc }> {
    const response = await this.request<{ flockdoc: BackendFlockdoc }>(`/v1/flockdocs/${id}`, {
      method: 'PATCH', body: JSON.stringify({ name }),
    });
    return { flockdoc: mapFlockdoc(response.flockdoc) };
  }

  async getState(id: string): Promise<FlockdocState> {
    const response = await this.request<{ flockdoc: BackendFlockdoc; revision: number; snapshotRevision?: number; snapshot: Record<string, unknown> | null }>(`/v1/flockdocs/${id}/state`);
    return { ...response, snapshotRevision: response.snapshotRevision ?? response.revision, flockdoc: mapFlockdoc(response.flockdoc) };
  }

  saveState(id: string, baseRevision: number, idempotencyKey: string, snapshot: unknown, clientId?: string) {
    return this.request<{ revision: number; snapshotKey: string; duplicate: boolean }>(`/v1/flockdocs/${id}/state`, {
      method: 'PUT', body: JSON.stringify({ baseRevision, idempotencyKey, snapshot, ...(clientId ? { clientId } : {}) }),
    });
  }

  realtimeTicket(id: string, clientId: string) {
    return this.request<{ url: string; expiresInSeconds: number }>(`/v1/flockdocs/${id}/realtime-ticket`, {
      method: 'POST', body: JSON.stringify({ clientId }),
    });
  }

  listUpdates(id: string, afterRevision: number, limit = 100) {
    const query = new URLSearchParams({ afterRevision: String(afterRevision), limit: String(limit) });
    return this.request<{
      updates: FlockdocCommittedEvent[];
      headRevision: number;
      retainedFromRevision: number | null;
      requiresSnapshot: boolean;
      page: { limit: number; hasMore: boolean; nextRevision: number };
    }>(`/v1/flockdocs/${id}/updates?${query}`);
  }

  appendSpreadsheetOperation(id: string, idempotencyKey: string, clientId: string, operation: SpreadsheetOperation) {
    return this.request<{ revision: number; duplicate: boolean }>(`/v1/flockdocs/${id}/updates`, {
      method: 'POST', body: JSON.stringify({ idempotencyKey, clientId, operation }),
    });
  }

  grantRole(id: string, principalType: string, principalId: string, role: string) {
    return this.request<void>(`/v1/flockdocs/${id}/access`, { method: 'POST', body: JSON.stringify({ principalType, principalId, role }) });
  }

  listAccess(id: string) {
    return this.request<{ grants: FlockdocAccessGrant[] }>(`/v1/flockdocs/${id}/access`);
  }

  grantUserRole(id: string, principalEmail: string, role: FlockdocAssignableRole) {
    return this.request<void>(`/v1/flockdocs/${id}/access`, { method: 'POST', body: JSON.stringify({ principalType: 'user', principalEmail, role }) });
  }

  removeAccess(id: string, principalType: FlockdocPrincipalType, principalId: string) {
    return this.request<void>(`/v1/flockdocs/${id}/access/${principalType}/${encodeURIComponent(principalId)}`, { method: 'DELETE' });
  }

  listShareLinks(id: string) {
    return this.request<{ shareLinks: FlockdocShareLink[] }>(`/v1/flockdocs/${id}/share-links`);
  }

  createShareLink(id: string, role: FlockdocLinkRole) {
    return this.request<{ shareLink: FlockdocShareLink & { token: string } }>(`/v1/flockdocs/${id}/share-links`, { method: 'POST', body: JSON.stringify({ role }) });
  }

  revokeShareLink(id: string, linkId: string) {
    return this.request<void>(`/v1/flockdocs/${id}/share-links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
  }

  async claimShareLink(token: string): Promise<{ flockdoc: Flockdoc }> {
    const response = await this.request<{ flockdoc: BackendFlockdoc }>(`/v1/flockdoc-links/${encodeURIComponent(token)}/claim`, { method: 'POST' });
    return { flockdoc: mapFlockdoc(response.flockdoc) };
  }

  async listMembers(id: string): Promise<{ flockdoc: Flockdoc; members: FlockdocMember[]; invitations: FlockdocInvitation[] }> {
    const response = await this.request<{ flockdoc: BackendFlockdoc; members: FlockdocMember[]; invitations: FlockdocInvitation[] }>(`/v1/flockdocs/${id}/members`);
    return { ...response, flockdoc: mapFlockdoc(response.flockdoc) };
  }

  inviteMember(id: string, email: string, role: FlockdocAssignableRole) {
    return this.request<{ invitation?: FlockdocInvitation; member?: FlockdocMember }>(`/v1/flockdocs/${id}/members`, { method: 'POST', body: JSON.stringify({ email, role }) });
  }

  changeMemberRole(id: string, email: string, role: FlockdocAssignableRole) {
    return this.request<{ member: FlockdocMember }>(`/v1/flockdocs/${id}/members/${encodeURIComponent(email)}`, { method: 'PATCH', body: JSON.stringify({ role }) });
  }

  removeMember(id: string, email: string) {
    return this.request<void>(`/v1/flockdocs/${id}/members/${encodeURIComponent(email)}`, { method: 'DELETE' });
  }

  async setVisibility(id: string, visibility: FlockdocVisibility): Promise<{ flockdoc: Flockdoc }> {
    const response = await this.request<{ flockdoc: BackendFlockdoc }>(`/v1/flockdocs/${id}/visibility`, { method: 'PATCH', body: JSON.stringify({ visibility }) });
    return { flockdoc: mapFlockdoc(response.flockdoc) };
  }

  async joinPublic(id: string): Promise<{ flockdoc: Flockdoc }> {
    const response = await this.request<{ flockdoc: BackendFlockdoc }>(`/v1/flockdocs/${id}/membership`, { method: 'POST' });
    return { flockdoc: mapFlockdoc(response.flockdoc) };
  }

  listInvitations() {
    return this.request<{ invitations: FlockdocInvitation[] }>('/v1/flockdoc-invitations');
  }

  respondToInvitation(id: string, response: 'accept' | 'decline') {
    return this.request<void>(`/v1/flockdoc-invitations/${encodeURIComponent(id)}/${response}`, { method: 'POST' });
  }
}
