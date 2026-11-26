import { visibleDepartments } from '@erp/shared';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogTitle, SheetContent } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { isDemoMode } from '@/lib/env';
import { readStorage, writeStorage } from '@/lib/storage';
import { useBranding } from '../branding';
import { useSession } from '../auth';
import { SessionTimeoutWarning } from './SessionTimeoutWarning';
import { ProjectSwitcher } from './ProjectSwitcher';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';
import { useCurrentDepartment } from './use-project-scope';

const COLLAPSED_KEY = 'erp.sidebarCollapsed';

/**
 * Signed-in layout: department sidebar (a drawer below 1024px), top bar with the project
 * switcher and account menu, and the page.
 */
export function AppShell() {
  const session = useSession();
  const branding = useBranding();
  const department = useCurrentDepartment();
  const [collapsed, setCollapsed] = useState(() => readStorage('local', COLLAPSED_KEY) === '1');
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The drawer remembers the page it was opened on, so it closes by itself when the page
  // changes (back button, links inside the page) without an effect.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  const drawerOpen = drawerPath === pathname;
  const setDrawerOpen = (open: boolean) => setDrawerPath(open ? pathname : null);

  // After moving to another page, put focus on its heading so screen readers announce it and
  // keyboard users continue from the top of the content. Not on first load, not on ?project=.
  const firstPath = useRef(pathname);
  useEffect(() => {
    if (pathname === firstPath.current) return;
    firstPath.current = '';
    // Wait a tick: the old page's heading is still in the DOM when the path first changes.
    const timer = window.setTimeout(() => {
      const main = document.getElementById('main');
      const target = main?.querySelector<HTMLElement>('h1') ?? main;
      target?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!session) return null; // The route guard redirects; this only covers sign-out mid-render.
  const departments = visibleDepartments(session.access);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeStorage('local', COLLAPSED_KEY, next ? '1' : null);
  };

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 font-medium shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside
        aria-label="Main"
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border transition-[width] duration-(--duration-base) lg:block',
          collapsed ? 'w-(--sidebar-collapsed-width)' : 'w-(--sidebar-width)',
        )}
      >
        <Sidebar
          departments={departments}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent aria-describedby={undefined}>
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <DialogDescription className="sr-only">Departments</DialogDescription>
          <Sidebar departments={departments} onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Dialog>

      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[padding] duration-(--duration-base)',
          collapsed ? 'lg:pl-(--sidebar-collapsed-width)' : 'lg:pl-(--sidebar-width)',
        )}
      >
        <header className="sticky top-0 z-20 flex h-(--topbar-height) items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:gap-3 sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu aria-hidden />
          </Button>
          <img
            src={branding.logoUrl}
            alt={branding.companyName}
            className="size-7 rounded-md lg:hidden max-sm:hidden"
          />
          <ProjectSwitcher department={department} />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {isDemoMode() && (
              <Badge tone="warning" title="Everything shown is fake demo data.">
                Demo data
              </Badge>
            )}
            <UserMenu session={session} />
            <SessionTimeoutWarning session={session} />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
