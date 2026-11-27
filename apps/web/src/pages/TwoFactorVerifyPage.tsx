import { useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { CircleX } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { isApiError } from '@/api/client';
import { authClient, clearSession, meQueryKey, pendingStep, useSession } from '@/app/auth';
import { usePageTitle } from '@/app/page-title';
import { safeRedirectPath } from '@/app/redirect';
import { StandaloneStep } from '@/components/two-factor';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';

const route = getRouteApi('/two-factor');

/** Second sign-in step: the 6-digit code from the authenticator app, or a recovery code. */
export function TwoFactorVerifyPage() {
  usePageTitle('Two-factor sign-in');
  const session = useSession();
  const { redirect } = route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const input = value.trim();
    if (!input) {
      setError(useRecovery ? 'Enter a recovery code.' : 'Enter the 6-digit code from your app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authClient().mfaVerify(
        useRecovery ? { recoveryCode: input } : { code: input },
      );
      const me = { user: res.user, session: res.session };
      queryClient.setQueryData(meQueryKey, me);
      toast.success(`Signed in as ${res.user.displayName}.`);
      const step = pendingStep(me);
      if (step) await navigate({ to: step, search: { redirect } });
      else await navigate({ href: safeRedirectPath(redirect) });
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        // Too many wrong codes: the account is locked and this half-signed-in session ended.
        clearSession(queryClient);
        await navigate({ to: '/login', search: { reason: 'expired' } });
        return;
      }
      setError(isApiError(err) ? err.message : 'Could not check the code. Please try again.');
      setValue('');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    await authClient()
      .logout()
      .catch(() => undefined);
    clearSession(queryClient);
    await navigate({ to: '/login', search: { reason: 'signed-out' } });
  };

  return (
    <StandaloneStep
      title="Two-factor sign-in"
      description={
        useRecovery
          ? 'Enter one of the recovery codes you saved when you set up two-factor sign-in. Each code works once.'
          : `Open your authenticator app and enter the 6-digit code for ${session.user.username}.`
      }
    >
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {useRecovery ? (
          <FormField label="Recovery code" required>
            <Input
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABCDE-FGHJK"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono tracking-wider"
            />
          </FormField>
        ) : (
          <FormField label="6-digit code" required>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123456"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d ]/g, ''))}
              className="tabular text-lg tracking-[0.3em]"
            />
          </FormField>
        )}
        {error && (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-danger/25 bg-danger-subtle p-3 text-sm text-danger-foreground"
          >
            <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{error}</p>
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Verify
        </Button>
        <div className="flex justify-between gap-2 text-sm">
          <Button
            variant="link"
            onClick={() => {
              setUseRecovery((r) => !r);
              setValue('');
              setError(null);
            }}
          >
            {useRecovery ? 'Use the code from my app' : 'Lost your phone? Use a recovery code'}
          </Button>
          <Button variant="link" onClick={() => void cancel()}>
            Cancel
          </Button>
        </div>
      </form>
    </StandaloneStep>
  );
}
