import { Link } from '@tanstack/react-router';
import { MapPinOff } from 'lucide-react';
import { useBranding } from '@/app/branding';
import { Button } from '@/components/ui/button';

/** Unknown address. Shown inside the shell when signed in, on its own otherwise. */
export function NotFoundPage() {
  const branding = useBranding();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <MapPinOff className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This address does not exist in {branding.productName}. It may have been mistyped, or the
          page has moved.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Go to the start page</Link>
      </Button>
    </div>
  );
}
