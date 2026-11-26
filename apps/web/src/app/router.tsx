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
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { StatusPage } from '@/pages/StatusPage';
import { RootLayout } from './RootLayout';
import { safeRedirectPath } from './redirect';
import { sessionStore } from './session';
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
  // The router JSON-parses query values, so "?project=123" arrives as a number.
  if (typeof p === 'string' && p !== '') return { project: p };
  if (typeof p === 'number' && Number.isFinite(p)) return { project: String(p) };
  return {};
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === 'string' ? { redirect: s.redirect } : {},
  beforeLoad: ({ search }) => {
    if (sessionStore.get()) throw redirect({ href: safeRedirectPath(search.redirect) });
  },
  component: LoginPage,
});

const statusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'status',
  component: StatusPage,
});

/** Everything behind sign-in. Phase 2 replaces the demo session check with a real one. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  validateSearch: validateAppSearch,
  beforeLoad: ({ location }) => {
    if (!sessionStore.get()) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: AppShell,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: ({ search }) => {
    const session = sessionStore.get();
    const first = session ? visibleDepartments(session.access)[0] : undefined;
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
  statusRoute,
  appRoute.addChildren([indexRoute, designSystemRoute, departmentRoute]),
]);

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
    ...(history ? { history } : {}),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
