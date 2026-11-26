import { type DepartmentAccess } from '@erp/shared';
import { DEMO_USER } from '@erp/shared/demo';
import { createStore, useStore } from '@/lib/store';

/**
 * TEMPORARY demo session, held in memory only (closing the app signs out). It decides what the UI
 * shows and nothing else. Phase 2 brings real sign-in with the token in secure storage; the API
 * enforces access from Phase 3. Not a security boundary (A20).
 */
export interface Session {
  user: { name: string; roleLabel: string };
  access: DepartmentAccess;
  demo: true;
}

export const sessionStore = createStore<Session | null>(null);

export function startDemoSession(): Session {
  const session: Session = { user: { ...DEMO_USER }, access: { all: true }, demo: true };
  sessionStore.set(session);
  return session;
}

export function signOut(): void {
  sessionStore.set(null);
}

export const useSession = () => useStore(sessionStore);
