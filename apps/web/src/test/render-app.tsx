import { type DepartmentAccess } from '@erp/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppRouter } from '@/app/router';
import { type Session, sessionStore } from '@/app/session';

export function signIn(access: DepartmentAccess = { all: true }, name = 'Test User'): Session {
  const session: Session = { user: { name, roleLabel: 'Tester' }, access, demo: true };
  sessionStore.set(session);
  return session;
}

/** Render the real app (routes, shell, pages) at a URL, using in-memory history. */
export function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createAppRouter(queryClient, history);
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, user, queryClient };
}

/** Current path + search, e.g. "/finance?project=PRJ-001". */
export function currentUrl(router: ReturnType<typeof renderApp>['router']): string {
  const { pathname, searchStr } = router.state.location;
  return `${pathname}${searchStr}`;
}
