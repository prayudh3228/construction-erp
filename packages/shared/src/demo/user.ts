/** FAKE demo user for the one-click demo sign-in (web and mobile). */
export interface DemoUser {
  name: string;
  roleLabel: string;
}

/** Sees every department (Director-like) until Phase 3 adds roles. */
export const DEMO_USER: DemoUser = { name: 'Demo Director', roleLabel: 'Director (demo)' };
