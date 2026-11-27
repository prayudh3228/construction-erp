import { Check, Copy, Download } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useBranding } from '@/app/branding';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { toast } from './ui/toaster';

/** Centred card for the steps between password and app (two-factor, password change). */
export function StandaloneStep({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const branding = useBranding();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2">
        <img src={branding.logoUrl} alt="" className="size-10 rounded-md" />
        <h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {title}
        </h1>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-xs">
        {children}
      </div>
    </main>
  );
}

/**
 * The recovery codes, shown once. The person must confirm they saved them before going on,
 * because without them a lost phone means asking the admin to reset two-factor.
 */
export function RecoveryCodes({
  codes,
  username,
  onDone,
  doneLabel = 'Continue',
}: {
  codes: string[];
  username: string;
  onDone: () => void;
  doneLabel?: string;
}) {
  const branding = useBranding();
  const [saved, setSaved] = useState(false);
  const text = [
    `${branding.productName} recovery codes for ${username}`,
    'Each code works once. Keep them somewhere safe, away from your phone.',
    '',
    ...codes,
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Recovery codes copied.');
    } catch {
      toast.error('Could not copy. Select the codes and copy them by hand.');
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-codes-${username}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-foreground">
        Save these codes now. If you lose your phone, a recovery code is the only way to sign in
        without asking the admin. Each code works once. They will not be shown again.
      </div>
      <ul
        aria-label="Recovery codes"
        className="grid grid-cols-2 gap-2 rounded-lg bg-surface-muted p-3 font-mono text-sm"
      >
        {codes.map((c) => (
          <li key={c} className="tabular text-center tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void copy()}>
          <Copy aria-hidden />
          Copy
        </Button>
        <Button variant="outline" onClick={download}>
          <Download aria-hidden />
          Download
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="codes-saved" checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
        <Label htmlFor="codes-saved">I have saved my recovery codes</Label>
      </div>
      <Button className="w-full" size="lg" disabled={!saved} onClick={onDone}>
        <Check aria-hidden />
        {doneLabel}
      </Button>
    </div>
  );
}
