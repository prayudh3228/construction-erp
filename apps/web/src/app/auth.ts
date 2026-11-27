import {
  AUTH_ERROR_CODES,
  type AuthUser,
  type DepartmentAccess,
  type LoginResponse,
  type MeResponse,
  type MfaEnableResponse,
  type MfaSetupResponse,
  type MfaStatus,
  ROLE_LABELS,
  type SessionInfo,
  loginResponseSchema,
  meResponseSchema,
  mfaEnableResponseSchema,
  mfaSetupResponseSchema,
  mfaStatusSchema,
  recoveryCodesResponseSchema,
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
  /** Opens a fresh session (new cookie) and returns it. */
  changePassword(currentPassword: string, newPassword: string): Promise<LoginResponse>;
  mfaStatus(): Promise<MfaStatus>;
  mfaSetup(): Promise<MfaSetupResponse>;
  mfaEnable(code: string): Promise<MfaEnableResponse>;
  mfaVerify(input: { code: string } | { recoveryCode: string }): Promise<LoginResponse>;
  mfaRegenerateCodes(code: string): Promise<string[]>;
  mfaDisable(code: string): Promise<MeResponse>;
}

export const httpAuthClient: AuthClient = {
  mfaStatus: () => apiFetch('/auth/mfa', { schema: mfaStatusSchema }),
  mfaSetup: () => apiFetch('/auth/mfa/setup', { method: 'POST', schema: mfaSetupResponseSchema }),
  mfaEnable: (code) =>
    apiFetch('/auth/mfa/enable', {
      method: 'POST',
      body: { code },
      schema: mfaEnableResponseSchema,
    }),
  mfaVerify: (input) =>
    apiFetch('/auth/mfa/verify', { method: 'POST', body: input, schema: loginResponseSchema }),
  mfaRegenerateCodes: async (code) =>
    (
      await apiFetch('/auth/mfa/recovery-codes', {
        method: 'POST',
        body: { code },
        schema: recoveryCodesResponseSchema,
      })
    ).recoveryCodes,
  mfaDisable: (code) =>
    apiFetch('/auth/mfa/disable', { method: 'POST', body: { code }, schema: meResponseSchema }),
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
      schema: loginResponseSchema,
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

export type SignInStep = '/two-factor' | '/two-factor/setup' | '/change-password';

/**
 * What a signed-in browser must do before it may use the app, in order: finish two-factor
 * (enter a code, or set it up), then change the password if required. Null: nothing, go ahead.
 */
export function pendingStep(me: MeResponse): SignInStep | null {
  if (me.session.stage === 'mfa_verify') return '/two-factor';
  if (me.session.stage === 'mfa_setup') return '/two-factor/setup';
  if (me.user.mustChangePassword) return '/change-password';
  return null;
}
