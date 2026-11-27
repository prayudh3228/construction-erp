import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { clearSession } from './app/auth';
import { createAppQueryClient } from './app/query-client';
import { createAppRouter } from './app/router';
import './index.css';

// When any request finds the session gone, forget it here and return to sign-in.
const queryClient = createAppQueryClient(() => {
  clearSession(queryClient);
  const { pathname, href } = router.state.location;
  if (pathname !== '/login') {
    void router.navigate({ to: '/login', search: { reason: 'expired', redirect: href } });
  }
});
const router = createAppRouter(queryClient);
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
