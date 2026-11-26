import { Outlet } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

export function RootLayout() {
  return (
    <TooltipProvider delayDuration={300}>
      <Outlet />
      <Toaster />
    </TooltipProvider>
  );
}
