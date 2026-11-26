import { type DepartmentAccess } from '@erp/shared';
import { useSyncExternalStore } from 'react';
import { DEMO_USER } from '@/demo/fixtures';
import { readStorage, writeStorage } from '@/lib/storage';

/**
 * TEMPORARY demo session, held in sessionStorage so it ends when the tab closes.
 * It only decides what the UI shows. Phase 2 replaces it with a real server session, and the API
 * (not this file) enforces access from Phase 3. Nothing here is a security boundary.
 */
export interface Session {
  user: { name: string; roleLabel: string };
  access: DepartmentAccess;
  demo: true;
}

const KEY = 'erp.demoSession';
const listeners = new Set<() => void>();
let cached: Session | null | undefined;

function load(): Session | null {
  const raw = readStorage('session', KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (parsed?.demo === true && parsed.user?.name && parsed.access) return parsed as Session;
  } catch {
    // Corrupt value: treat as signed out.
  }
  return null;
}

export const sessionStore = {
  get(): Session | null {
    if (cached === undefined) cached = load();
    return cached;
  },
  set(session: Session | null): void {
    cached = session;
    writeStorage('session', KEY, session ? JSON.stringify(session) : null);
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Forget the in-memory copy (tests). */
  reset(): void {
    cached = undefined;
  },
};

export function startDemoSession(): Session {
  const session: Session = { user: { ...DEMO_USER }, access: { all: true }, demo: true };
  sessionStore.set(session);
  return session;
}

export function useSession(): Session | null {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
}
