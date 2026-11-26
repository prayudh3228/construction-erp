import { CircleX, Inbox, RefreshCw } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

interface StateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Nothing to show yet. Always say why, and what the user can do next. */
export function EmptyState({ title, description, icon, action, className }: StateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-muted-foreground [&_svg]:size-5">
        {icon ?? <Inbox aria-hidden />}
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps extends Omit<StateProps, 'icon'> {
  onRetry?: () => void;
  retrying?: boolean;
}

/** Something went wrong. Announced to screen readers; offers a retry when one makes sense. */
export function ErrorState({
  title,
  description,
  action,
  onRetry,
  retrying,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/25 bg-danger-subtle px-6 py-10 text-center',
        className,
      )}
    >
      <CircleX className="size-6 text-danger" aria-hidden />
      <div className="max-w-md space-y-1">
        <h3 className="text-base font-semibold text-danger-foreground">{title}</h3>
        {description && <p className="text-sm text-danger-foreground">{description}</p>}
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry} loading={retrying}>
            {!retrying && <RefreshCw aria-hidden />}
            Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}

/** Placeholder lines while a section loads. The label is read out instead of the skeleton. */
export function LoadingState({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
