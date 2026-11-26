import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isSignedOutError } from './auth';

/**
 * The app's query client. When any request finds the session gone (timed out, signed out
 * elsewhere, account deactivated), `onSignedOut` runs once so the app can return to sign-in.
 */
export function createAppQueryClient(
  onSignedOut: () => void,
  options: { retryDelayMs?: number } = {},
): QueryClient {
  const handle = (error: unknown) => {
    if (isSignedOutError(error)) onSignedOut();
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError: handle }),
    mutationCache: new MutationCache({ onError: handle }),
    defaultOptions: {
      queries: {
        // Do not retry an answer that will not change (signed out, forbidden, validation).
        retry: (count, error) =>
          count < 1 &&
          !(error instanceof Error && 'status' in error && Number(error.status) >= 400),
        ...(options.retryDelayMs !== undefined ? { retryDelay: options.retryDelayMs } : {}),
      },
    },
  });
}
