import { type ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const fieldBase =
  'w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 aria-invalid:border-danger';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input type={type} className={cn(fieldBase, 'h-9', className)} {...props} />;
}

/** Native select: accessible, keyboard friendly and fast for short option lists. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(fieldBase, 'h-9 pr-8', className)} {...props} />;
}
