export type FlockdocType = 'paper' | 'spreadsheet';
export type WorkspaceFilter = 'all' | 'paper' | 'spreadsheet';

export interface Collaborator {
  id: string;
  name: string;
  kind: 'person' | 'agent';
  initials?: string;
  color?: string;
}

export interface Flockdoc {
  id: string;
  name: string;
  type: FlockdocType;
  modifiedAt: string;
  starred?: boolean;
  collaborators: Collaborator[];
  snapshot?: unknown;
}

export interface Comment {
  id: string;
  author: Collaborator;
  body: string;
  createdAt: string;
  replies?: Comment[];
}
