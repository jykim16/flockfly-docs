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
  prefix: string;
  visibility?: FlockdocVisibility;
  collaborators: Collaborator[];
  snapshot?: unknown;
  headRevision?: number;
  role?: FlockdocRole;
  permissions?: FlockdocPermissions;
}

export type FlockdocRole = 'owner' | 'manager' | 'editor' | 'commenter' | 'viewer';
export type FlockdocAssignableRole = Exclude<FlockdocRole, 'owner'>;
export type FlockdocLinkRole = Exclude<FlockdocRole, 'owner' | 'manager' | 'editor'>;
export type FlockdocVisibility = 'private' | 'public';
export type FlockdocPrincipalType = 'user' | 'team' | 'agent';

export interface FlockdocAccessGrant {
  principalType: FlockdocPrincipalType;
  principalId: string;
  role: FlockdocAssignableRole;
  email?: string;
  username?: string | null;
  status?: 'active' | 'pending_account';
}

export interface FlockdocShareLink {
  id: string;
  flockdocId: string;
  role: FlockdocLinkRole;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  token?: string;
}

export interface FlockdocMember {
  entityType: 'flockdoc';
  entityId: string;
  email: string;
  userId: string | null;
  username: string | null;
  role: FlockdocRole;
  status: 'active' | 'pending_account';
  accessTypes: string[];
  createdAt: string;
}

export interface FlockdocInvitation {
  id: string;
  flockdocId: string;
  flockdocName: string;
  flockdocType: FlockdocType;
  email: string;
  role: FlockdocAssignableRole;
  invitedByUserId: string;
  createdAt: string;
}

export interface FlockdocPermissions {
  canRead: boolean;
  canComment: boolean;
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
}
