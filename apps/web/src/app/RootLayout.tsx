import { type ErrorComponentProps, Outlet, useRouter } from '@tanstack/react-router';
import { ErrorState } from '@/components/states';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { usePageTitle } from './page-title';

export function RootLayout() {
  return (
    <TooltipProvider delayDuration={300}>
      <Outlet />
      <Toaster />
    </TooltipProvider>
  );
}

/** The app could not start a page at all, usually because the server cannot be reached. */
export function RootErrorPage({ error }: ErrorComponentProps) {
  const router = useRouter();
  usePageTitle('Something went wrong');
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <TooltipProvider>
      <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
        <ErrorState
          className="w-full"
          title="Could not open this page"
          description={message}
          onRetry={() => void router.invalidate()}
        />
      </main>
    </TooltipProvider>
  );
}
