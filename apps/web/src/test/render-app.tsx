import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearSession } from '@/app/auth';
import { createAppQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/app/router';

export { signIn } from './fake-auth';

/** Render the real app (routes, shell, pages) at a URL, with the same wiring as main.tsx. */
export function renderApp(path: string) {
  const queryClient = createAppQueryClient(
    () => {
      clearSession(queryClient);
      const { pathname, href } = router.state.location;
      if (pathname !== '/login') {
        void router.navigate({ to: '/login', search: { reason: 'expired', redirect: href } });
      }
    },
    // Same retry rule as the app, without the wait.
    { retryDelayMs: 0 },
  );
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
