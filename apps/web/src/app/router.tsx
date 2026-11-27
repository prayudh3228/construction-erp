import { visibleDepartments } from '@erp/shared';
import { type QueryClient } from '@tanstack/react-query';
import {
  type RouterHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { LoadingState } from '@/components/states';
import { isDemoMode } from '@/lib/env';
import { DepartmentPage } from '@/pages/DepartmentPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { StatusPage } from '@/pages/StatusPage';
import { RootErrorPage, RootLayout } from './RootLayout';
import { safeRedirectPath } from './redirect';
import { parseSearch, stringifySearch } from './search-params';
import { meQuery, toSession } from './auth';
import { AppShell } from './shell/AppShell';

// Demo-only page: loaded on demand so it is not in the main bundle.
const DesignSystemPage = lazy(() =>
  import('@/pages/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })),
);

export interface RouterContext {
  queryClient: QueryClient;
}

/** The project switcher's value travels in `?project=`; see parseProjectScope in @erp/shared. */
export interface AppSearch {
  project?: string;
}

function validateAppSearch(search: Record<string, unknown>): AppSearch {
  const p = search.project;
  // Query values arrive as raw strings (see search-params.ts).
  return typeof p === 'string' && p !== '' ? { project: p } : {};
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  // Shown when the session cannot be checked at all (API down, network lost).
  errorComponent: RootErrorPage,
});

export interface LoginSearch {
  redirect?: string;
  /** "expired" when the session ended by itself, "signed-out" after signing out. */
  reason?: 'expired' | 'signed-out';
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    ...(typeof s.redirect === 'string' ? { redirect: s.redirect } : {}),
    ...(s.reason === 'expired' || s.reason === 'signed-out' ? { reason: s.reason } : {}),
  }),
  beforeLoad: async ({ search, context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.user.mustChangePassword) throw redirect({ to: '/change-password' });
    if (me) throw redirect({ href: safeRedirectPath(search.redirect) });
  },
  component: LoginPage,
});

/** Standalone (no shell): a user who must change their password can open nothing else. */
const changePasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'change-password',
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } });
  },
  component: ChangePasswordPage,
});

const statusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'status',
  component: StatusPage,
});

/** Everything behind sign-in. The server decides: the session comes from GET /api/auth/me. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  validateSearch: validateAppSearch,
  beforeLoad: async ({ location, context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } });
    if (me.user.mustChangePassword) throw redirect({ to: '/change-password' });
  },
  component: AppShell,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: ({ search, context }) => {
    const me = context.queryClient.getQueryData(meQuery.queryKey);
    const first = me ? visibleDepartments(toSession(me).access)[0] : undefined;
    if (first) {
      throw redirect({ to: '/$departmentId', params: { departmentId: first.id }, search });
    }
  },
  component: DepartmentPage,
});

const designSystemRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'design-system',
  // Rendered (not thrown) so the not-found page stays inside the signed-in shell.
  component: () =>
    isDemoMode() ? (
      <Suspense fallback={<LoadingState label="Loading design system…" />}>
        <DesignSystemPage />
      </Suspense>
    ) : (
      <NotFoundPage />
    ),
});

export const departmentRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '$departmentId',
  // An unknown department renders the not-found page inside the shell (see DepartmentPage).
  component: DepartmentPage,
});

export const routeTree = rootRoute.addChildren([
  loginRoute,
  changePasswordRoute,
  statusRoute,
  appRoute.addChildren([indexRoute, designSystemRoute, departmentRoute]),
]);

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    parseSearch,
    stringifySearch,
    scrollRestoration: true,
    ...(history ? { history } : {}),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
