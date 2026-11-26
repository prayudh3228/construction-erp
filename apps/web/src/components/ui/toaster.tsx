import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

/** Success and info messages. Errors that block work are shown inline, not only as a toast. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg! border! border-border! bg-surface-raised! text-foreground! shadow-md! font-sans!',
          description: 'text-muted-foreground!',
        },
      }}
    />
  );
}
