import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Activity, KeyRound, LogOut, Palette } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toaster';
import { isDemoMode } from '@/lib/env';
import { type Session, authClient, clearSession } from '../auth';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

export function UserMenu({ session }: { session: Session }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    // Even if the server cannot be reached, forget the session in this tab.
    await authClient()
      .logout()
      .catch(() => undefined);
    clearSession(queryClient);
    toast.success('You have signed out.');
    await navigate({ to: '/login', search: { reason: 'signed-out' } });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 items-center gap-2 rounded-full pr-1 pl-1 hover:bg-surface-muted sm:pr-3"
        aria-label={`Account menu for ${session.user.name}`}
      >
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initials(session.user.name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium">{session.user.name}</span>
          <span className="block text-xs text-muted-foreground">{session.user.roleLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">{session.user.name}</span>
          <span className="block">{session.user.roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isDemoMode() && (
          <DropdownMenuItem asChild>
            <Link to="/design-system">
              <Palette aria-hidden />
              Design system
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/change-password">
            <KeyRound aria-hidden />
            Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/status">
            <Activity aria-hidden />
            System status
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
