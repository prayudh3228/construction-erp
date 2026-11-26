import { type VariantProps, cva } from 'class-variance-authority';
import { type ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-muted-foreground ring-border',
        brand: 'bg-accent text-accent-foreground ring-border',
        success: 'bg-success-subtle text-success-foreground ring-success/20',
        warning: 'bg-warning-subtle text-warning-foreground ring-warning/30',
        danger: 'bg-danger-subtle text-danger-foreground ring-danger/20',
        info: 'bg-info-subtle text-info-foreground ring-info/20',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
