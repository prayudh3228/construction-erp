import { type MfaEnableResponse, type MfaSetupResponse } from '@erp/shared';
import { useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import QRCode from 'qrcode';
import { type FormEvent, useEffect, useState } from 'react';
import { isApiError } from '@/api/client';
import { authClient, clearSession, meQueryKey, pendingStep, useSession } from '@/app/auth';
import { usePageTitle } from '@/app/page-title';
import { safeRedirectPath } from '@/app/redirect';
import { ErrorState, LoadingState } from '@/components/states';
import { RecoveryCodes, StandaloneStep } from '@/components/two-factor';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';

const route = getRouteApi('/two-factor/setup');

/** Groups of four, as authenticator apps show secrets for typing in by hand. */
function groupSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

/**
 * Set up an authenticator app: scan the QR code (or type the key), confirm with a code, then
 * save the recovery codes. Required before anything else for Admin, Director and Finance.
 */
export function TwoFactorSetupPage() {
  usePageTitle('Set up two-factor sign-in');
  const session = useSession();
  const { redirect } = route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  /** An ordinary signed-in session must confirm the password (a stolen session cannot enrol). */
  const [needPassword, setNeedPassword] = useState(session?.info.stage === 'full');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<MfaEnableResponse | null>(null);

  // Ask the server for a new secret when the page opens (or on retry).
  useEffect(() => {
    let live = true;
    authClient()
      .mfaSetup()
      .then(async (s) => {
        const svg = await QRCode.toString(s.otpauthUri, { type: 'svg', margin: 1, width: 192 });
        if (!live) return;
        setSetup(s);
        setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (live) setLoadError(isApiError(e) ? e.message : 'Could not start the setup.');
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  if (!session) return null;
  const required = session.user.mfa.required;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      setError('Enter the 6-digit code your app shows now.');
      return;
    }
    if (needPassword && !password) {
      setError('Enter your password to confirm.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setEnabled(await authClient().mfaEnable(code, needPassword ? password : undefined));
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        clearSession(queryClient);
        await navigate({ to: '/login', search: { reason: 'expired' } });
        return;
      }
      if (isApiError(err) && err.code === 'WRONG_CURRENT_PASSWORD') {
        setNeedPassword(true);
        setPassword('');
      }
      setError(isApiError(err) ? err.message : 'Could not check the code. Please try again.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!enabled) return;
    const me = { user: enabled.user, session: enabled.session };
    queryClient.setQueryData(meQueryKey, me);
    toast.success('Two-factor sign-in is on.');
    const step = pendingStep(me);
    if (step) await navigate({ to: step, search: { redirect } });
    else await navigate({ href: safeRedirectPath(redirect) });
  };

  const leave = async () => {
    if (!required || session.info.stage === 'full') {
      await navigate({ href: safeRedirectPath(redirect) });
      return;
    }
    await authClient()
      .logout()
      .catch(() => undefined);
    clearSession(queryClient);
    await navigate({ to: '/login', search: { reason: 'signed-out' } });
  };

  if (enabled) {
    return (
      <StandaloneStep title="Save your recovery codes">
        <RecoveryCodes
          codes={enabled.recoveryCodes}
          username={session.user.username}
          onDone={() => void finish()}
        />
      </StandaloneStep>
    );
  }

  return (
    <StandaloneStep
      title="Set up two-factor sign-in"
      description={
        required
          ? 'Your role needs a second step when signing in: a code from an authenticator app on your phone (for example Google Authenticator or Microsoft Authenticator).'
          : 'Add a second step when signing in: a code from an authenticator app on your phone.'
      }
    >
      {loadError ? (
        <ErrorState
          title="Could not start the setup"
          description={loadError}
          onRetry={() => setAttempt((a) => a + 1)}
        />
      ) : !setup || !qr ? (
        <LoadingState label="Preparing your setup…" />
      ) : (
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              In your authenticator app, add an account and scan this code.
              <img
                src={qr}
                alt="QR code to scan with your authenticator app"
                className="mt-2 size-48 rounded-md border border-border bg-white p-2"
              />
            </li>
            <li>
              Cannot scan? Type this key instead:
              <code
                aria-label="Setup key"
                className="mt-1 block rounded-md bg-surface-muted px-2 py-1.5 font-mono text-sm tracking-wider break-all"
              >
                {groupSecret(setup.secret)}
              </code>
            </li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          {needPassword && (
            <FormField label="Your password" hint="To confirm it is you." required>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
          )}
          <FormField label="6-digit code" error={error ?? undefined} required>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
              className="tabular text-lg tracking-[0.3em]"
            />
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => void leave()}>
              {required && session.info.stage !== 'full' ? 'Sign out' : 'Cancel'}
            </Button>
            <Button type="submit" loading={busy}>
              Turn on two-factor sign-in
            </Button>
          </div>
        </form>
      )}
    </StandaloneStep>
  );
}
