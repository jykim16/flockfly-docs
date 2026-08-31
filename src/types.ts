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
  parentFolderId?: string | null;
  collaborators: Collaborator[];
  snapshot?: unknown;
  headRevision?: number;
  role?: FlockdocRole;
  permissions?: FlockdocPermissions;
}

export interface FlockdocFolder {
  id: string;
  name: string;
  parentFolderId: string | null;
  modifiedAt: string;
}

export type FlockdocRole = 'owner' | 'manager' | 'editor' | 'commenter' | 'viewer';

export interface FlockdocPermissions {
  canRead: boolean;
  canComment: boolean;
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
}
