import { Check } from 'lucide-react';
import { DropdownMenu as Menu } from 'radix-ui';
import { type ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-44 overflow-hidden rounded-lg border border-border bg-surface-raised p-1 text-sm shadow-md',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

const itemBase =
  'relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-muted [&_svg]:size-4 [&_svg]:text-muted-foreground';

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return <Menu.Item className={cn(itemBase, className)} {...props} />;
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.CheckboxItem>) {
  return (
    <Menu.CheckboxItem className={cn(itemBase, 'pl-8', className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <Menu.ItemIndicator>
          <Check aria-hidden />
        </Menu.ItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return (
    <Menu.Label
      className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
