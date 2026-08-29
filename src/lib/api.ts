import type { Comment, Flockdoc, FlockdocType } from '../types';

const API_URL = import.meta.env.VITE_FLOCKFLY_API_URL ?? 'http://localhost:8800';

export class FlockdocApi {
  constructor(private readonly token?: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) throw new Error(`Flockdoc API ${response.status}`);
    return response.json() as Promise<T>;
  }

  list() { return this.request<{ flockdocs: Flockdoc[] }>('/v1/flockdocs'); }
  create(name: string, type: FlockdocType) {
    return this.request<{ flockdoc: Flockdoc }>('/v1/flockdocs', { method: 'POST', body: JSON.stringify({ name, type }) });
  }
  rename(id: string, name: string) {
    return this.request<{ flockdoc: Flockdoc }>(`/v1/flockdocs/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
  }
  addComment(id: string, body: string, anchor?: unknown) {
    return this.request<{ comment: Comment }>(`/v1/flockdocs/${id}/comments`, { method: 'POST', body: JSON.stringify({ body, anchor }) });
  }
  grantRole(id: string, principalType: string, principalId: string, role: string) {
    return this.request(`/v1/flockdocs/${id}/access`, { method: 'POST', body: JSON.stringify({ principalType, principalId, role }) });
  }
  appendUpdate(id: string, clientUpdateId: string, payload: unknown) {
    return this.request(`/v1/flockdocs/${id}/updates`, { method: 'POST', body: JSON.stringify({ clientUpdateId, payload }) });
  }
}
