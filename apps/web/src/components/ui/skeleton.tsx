import { type ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Grey placeholder block shown while content loads. Hidden from screen readers. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-surface-muted', className)}
      {...props}
    />
  );
}
