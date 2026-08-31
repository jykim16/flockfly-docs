import type { FlockdocAssignableRole, FlockdocRole } from '../types';

export const flockdocAssignableRoles: FlockdocAssignableRole[] = ['manager', 'editor', 'commenter', 'viewer'];

export function flockdocRoleLabel(role: FlockdocRole) {
  if (role === 'owner') return 'Owner';
  if (role === 'manager') return 'Can manage';
  if (role === 'editor') return 'Can edit';
  if (role === 'commenter') return 'Can comment';
  return 'Can view';
}
