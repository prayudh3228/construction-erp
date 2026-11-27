import { type RoleKey } from '../auth/roles.js';

/**
 * FAKE demo accounts seeded into local databases. The API's demo sign-in (only when
 * AUTH_DEMO_LOGIN=true, never in production) accepts these usernames and nothing else.
 */
export interface DemoAccount {
  username: string;
  displayName: string;
  role: RoleKey;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { username: 'demo.director', displayName: 'Demo Director', role: 'director' },
  { username: 'demo.admin', displayName: 'Demo Admin', role: 'admin' },
  { username: 'demo.finance', displayName: 'Demo Finance', role: 'finance' },
  { username: 'demo.hr', displayName: 'Demo HR', role: 'hr' },
  { username: 'demo.purchase', displayName: 'Demo Purchase', role: 'purchase' },
  { username: 'demo.stores', displayName: 'Demo Stores', role: 'stores' },
  { username: 'demo.planning', displayName: 'Demo Planning', role: 'planning' },
  { username: 'demo.site', displayName: 'Demo Site Engineer', role: 'site' },
  { username: 'demo.sales', displayName: 'Demo Sales', role: 'sales' },
];

export function isDemoUsername(username: string): boolean {
  const u = username.trim().toLowerCase();
  return DEMO_ACCOUNTS.some((a) => a.username === u);
}
