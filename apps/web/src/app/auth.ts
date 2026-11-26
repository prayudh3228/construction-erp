import {
  AUTH_ERROR_CODES,
  type AuthUser,
  type DepartmentAccess,
  type LoginResponse,
  type MeResponse,
  ROLE_LABELS,
  type SessionInfo,
  loginResponseSchema,
  meResponseSchema,
} from '@erp/shared';
import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query';
import { apiFetch, isApiError } from '@/api/client';

/** The sign-in calls the web app makes. Tests swap in a fake with setAuthClient(). */
export interface AuthClient {
  /** The current session, or null when signed out or expired. */
  me(): Promise<MeResponse | null>;
  login(username: string, password: string): Promise<LoginResponse>;
  demoLogin(username: string): Promise<LoginResponse>;
  logout(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<MeResponse>;
}

export const httpAuthClient: AuthClient = {
  async me() {
    try {
      return await apiFetch('/auth/me', { schema: meResponseSchema });
    } catch (e) {
      if (isApiError(e) && e.status === 401) return null;
      throw e;
    }
  },
  login: (username, password) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: { username, password },
      schema: loginResponseSchema,
    }),
  demoLogin: (username) =>
    apiFetch('/auth/demo-login', {
      method: 'POST',
      body: { username },
      schema: loginResponseSchema,
    }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword, newPassword) =>
    apiFetch('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
      schema: meResponseSchema,
    }),
};

let client: AuthClient = httpAuthClient;
export const authClient = (): AuthClient => client;
export function setAuthClient(next: AuthClient): void {
  client = next;
}

export const meQueryKey = ['auth', 'me'] as const;

/** Cached for the life of the page; refreshed by sign-in, sign-out and the timeout warning. */
export const meQuery = queryOptions({
  queryKey: meQueryKey,
  queryFn: () => client.me(),
  staleTime: Infinity,
  retry: false,
});

/**
 * What screens may SHOW. PROVISIONAL: every signed-in user sees every department until Phase 3
 * returns the user's real department access from the API. The API enforces access, not this.
 */
type AccessResolver = (user: AuthUser) => DepartmentAccess;
let resolveAccess: AccessResolver = () => ({ all: true });
/** Tests only, until Phase 3. */
export function setAccessResolver(next: AccessResolver): void {
  resolveAccess = next;
}

export interface Session {
  user: AuthUser & { name: string; roleLabel: string };
  access: DepartmentAccess;
  info: SessionInfo;
}

export function toSession(me: MeResponse): Session {
  return {
    user: { ...me.user, name: me.user.displayName, roleLabel: ROLE_LABELS[me.user.role] },
    access: resolveAccess(me.user),
    info: me.session,
  };
}

export function useSession(): Session | null {
  const { data } = useQuery(meQuery);
  return data ? toSession(data) : null;
}

/** Forget the session in this tab (after sign-out, or when the server says it has ended). */
export function clearSession(queryClient: QueryClient): void {
  queryClient.setQueryData(meQueryKey, null);
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== meQueryKey[0] });
}

/** True for answers that mean "this browser is no longer signed in". */
export function isSignedOutError(e: unknown): boolean {
  return (
    isApiError(e) &&
    e.status === 401 &&
    (e.code === AUTH_ERROR_CODES.unauthenticated || e.code === AUTH_ERROR_CODES.sessionExpired)
  );
}
