import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { isApiError } from '@/api/client';
import { authClient, meQueryKey, useSession } from '@/app/auth';
import { usePageTitle } from '@/app/page-title';
import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/states';
import { RecoveryCodes } from '@/components/two-factor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';

const statusKey = ['auth', 'mfa-status'] as const;

type Action = 'regenerate' | 'disable';

/** Password and two-factor settings for the signed-in user. */
export function AccountSecurityPage() {
  usePageTitle('Account security');
  const session = useSession();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: statusKey, queryFn: () => authClient().mfaStatus() });
  const [action, setAction] = useState<Action | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  if (!session) return null;

  const close = () => {
    setAction(null);
    setCode('');
    setPassword('');
    setError(null);
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      setError('Enter the 6-digit code your app shows now.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (action === 'regenerate') {
        setNewCodes(await authClient().mfaRegenerateCodes(code, password));
      } else {
        const me = await authClient().mfaDisable(code, password);
        queryClient.setQueryData(meQueryKey, me);
        toast.success('Two-factor sign-in is off.');
      }
      await queryClient.invalidateQueries({ queryKey: statusKey });
      close();
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Account security" description="Your password and two-factor sign-in." />

      <Card aria-labelledby="password-heading">
        <CardHeader>
          <CardTitle id="password-heading">Password</CardTitle>
          <CardDescription>Changing it signs you out on your other devices.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/change-password">
              <KeyRound aria-hidden />
              Change password
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card aria-labelledby="mfa-heading">
        <CardHeader>
          <CardTitle id="mfa-heading">Two-factor sign-in</CardTitle>
          <CardDescription>
            A code from an authenticator app on your phone, after your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.isPending && <LoadingState label="Loading…" rows={2} />}
          {status.isError && (
            <ErrorState
              title="Could not load your settings"
              onRetry={() => void status.refetch()}
            />
          )}
          {status.isSuccess && newCodes && (
            <RecoveryCodes
              codes={newCodes}
              username={session.user.username}
              doneLabel="Done"
              onDone={() => setNewCodes(null)}
            />
          )}
          {status.isSuccess && !newCodes && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {status.data.enabled ? (
                  <Badge tone="success">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    On
                  </Badge>
                ) : (
                  <Badge tone="warning">
                    <ShieldOff className="size-3.5" aria-hidden />
                    Off
                  </Badge>
                )}
                {status.data.required && <Badge tone="info">Required for your role</Badge>}
              </div>
              {status.data.enabled ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Recovery codes left:{' '}
                    <span className="tabular font-medium text-foreground">
                      {status.data.recoveryCodesLeft}
                    </span>
                    {status.data.recoveryCodesLeft <= 3 && ' — make new ones soon.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setAction('regenerate')}>
                      Make new recovery codes
                    </Button>
                    {!status.data.required && (
                      <Button variant="danger" onClick={() => setAction('disable')}>
                        Turn off
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <Button asChild>
                  <Link to="/two-factor/setup" search={{ redirect: '/account/security' }}>
                    Turn on two-factor sign-in
                  </Link>
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={action !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogTitle>
            {action === 'regenerate' ? 'Make new recovery codes?' : 'Turn off two-factor sign-in?'}
          </DialogTitle>
          <DialogDescription>
            {action === 'regenerate'
              ? 'Your old recovery codes will stop working. Enter your password and the code from your app to continue.'
              : 'Signing in will need only your password. Enter your password and the code from your app to confirm.'}
          </DialogDescription>
          <form noValidate onSubmit={(e) => void confirm(e)} className="space-y-4">
            <FormField label="Your password" required>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <FormField label="6-digit code" error={error ?? undefined} required>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
                className="tabular tracking-[0.3em]"
              />
            </FormField>
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={action === 'disable' ? 'danger' : 'primary'}
                loading={busy}
              >
                {action === 'regenerate' ? 'Make new codes' : 'Turn off'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
