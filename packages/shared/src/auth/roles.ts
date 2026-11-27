import { z } from 'zod';

/**
 * PROVISIONAL role keys (Phase 2). Phase 3 replaces this single field with the full role,
 * permission-level and project-assignment model; until then it decides only two things:
 * who must use two-factor sign-in, and who may manage users.
 */
export const ROLE_KEYS = [
  'admin',
  'director',
  'finance',
  'hr',
  'purchase',
  'stores',
  'planning',
  'site',
  'sales',
] as const;

export const roleKeySchema = z.enum(ROLE_KEYS);
export type RoleKey = z.infer<typeof roleKeySchema>;

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin: 'Admin',
  director: 'Director',
  finance: 'Finance',
  hr: 'HR',
  purchase: 'Purchase',
  stores: 'Stores',
  planning: 'Planning',
  site: 'Site',
  sales: 'Sales',
};

/** The brief requires two-factor sign-in for these roles. Becomes a setting in Phase 4. */
export const MFA_REQUIRED_ROLES: readonly RoleKey[] = ['admin', 'director', 'finance'];

export function roleRequiresMfa(role: RoleKey): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}
