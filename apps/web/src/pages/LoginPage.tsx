import { type LoginForm, type LoginResponse, ROLE_LABELS, loginFormSchema } from '@erp/shared';
import { DEMO_ACCOUNTS } from '@erp/shared/demo';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { CircleX, Info } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { isApiError } from '@/api/client';
import { authClient, meQueryKey, pendingStep } from '@/app/auth';
import { useBranding } from '@/app/branding';
import { usePageTitle } from '@/app/page-title';
import { safeRedirectPath } from '@/app/redirect';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input, NativeSelect } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { isDemoMode } from '@/lib/env';

const route = getRouteApi('/login');

const REASON_NOTICE = {
  expired: 'Your session ended because of inactivity or the daily limit. Please sign in again.',
  'signed-out': 'You have signed out.',
} as const;

function messageOf(error: unknown): string {
  return isApiError(error) ? error.message : 'Sign-in failed. Please try again.';
}

export function LoginPage() {
  const branding = useBranding();
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { redirect, reason } = route.useSearch();
  const demo = isDemoMode();
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const [otherDemo, setOtherDemo] = useState(DEMO_ACCOUNTS[1]?.username ?? '');

  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginFormSchema),
    mode: 'onTouched',
    defaultValues: { username: '', password: '' },
  });

  const enter = async (response: LoginResponse) => {
    const me = { user: response.user, session: response.session };
    queryClient.setQueryData(meQueryKey, me);
    const step = pendingStep(me);
    if (step) {
      // Password accepted; two-factor (or a password change) comes next.
      await navigate({ to: step, search: { redirect } });
      return;
    }
    toast.success(`Signed in as ${response.user.displayName}.`);
    await navigate({ href: safeRedirectPath(redirect) });
  };

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setError(null);
    try {
      await enter(await authClient().login(username, password));
    } catch (e) {
      setError(messageOf(e));
      resetField('password');
    }
  });

  const demoSignIn = async (username: string) => {
    setError(null);
    setDemoBusy(username);
    try {
      await enter(await authClient().demoLogin(username));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setDemoBusy(null);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(28rem,36rem)]">
      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div className="flex items-center gap-3">
          <img src={branding.logoUrl} alt="" className="size-10 rounded-md bg-surface/10 p-1" />
          <span className="text-lg font-semibold">{branding.companyName}</span>
        </div>
        <div className="max-w-md space-y-3">
          <p className="text-3xl leading-tight font-semibold">
            Projects, purchase, stores, accounts and people in one place.
          </p>
          <p className="text-primary-foreground/80">
            Office and site teams work from the same project records.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">{branding.productName}</p>
        {/* Calm blueprint grid as decoration. */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] bg-size-[32px_32px]" />
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <img src={branding.logoUrl} alt="" className="size-10 rounded-md lg:hidden" />
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              {branding.productName} for {branding.companyName}
            </p>
          </div>

          {reason && !error && (
            <div
              role="status"
              className="flex gap-2 rounded-lg border border-info/25 bg-info-subtle p-3 text-sm text-info-foreground"
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>{REASON_NOTICE[reason]}</p>
            </div>
          )}

          {demo && (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-xs">
              <p className="text-sm text-muted-foreground">
                This is a demo with fake data. No password is needed.
              </p>
              <Button
                size="lg"
                className="w-full"
                loading={demoBusy === DEMO_ACCOUNTS[0]?.username}
                disabled={demoBusy !== null}
                onClick={() => void demoSignIn(DEMO_ACCOUNTS[0]!.username)}
              >
                Continue as demo user
              </Button>
              <div className="flex gap-2">
                <NativeSelect
                  aria-label="Other demo account"
                  value={otherDemo}
                  onChange={(e) => setOtherDemo(e.target.value)}
                >
                  {DEMO_ACCOUNTS.slice(1).map((a) => (
                    <option key={a.username} value={a.username}>
                      {a.displayName} ({ROLE_LABELS[a.role]})
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  variant="outline"
                  loading={demoBusy === otherDemo}
                  disabled={demoBusy !== null}
                  onClick={() => void demoSignIn(otherDemo)}
                >
                  Sign in
                  <span className="sr-only"> as the selected demo account</span>
                </Button>
              </div>
            </div>
          )}

          <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <FormField label="Username or email" error={errors.username?.message} required>
              <Input autoComplete="username" autoCapitalize="none" {...register('username')} />
            </FormField>
            <FormField label="Password" error={errors.password?.message} required>
              <Input type="password" autoComplete="current-password" {...register('password')} />
            </FormField>
            {error && (
              <div
                role="alert"
                className="flex gap-2 rounded-lg border border-danger/25 bg-danger-subtle p-3 text-sm text-danger-foreground"
              >
                <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>{error}</p>
              </div>
            )}
            <Button
              type="submit"
              variant={demo ? 'outline' : 'primary'}
              size="lg"
              className="w-full"
              loading={isSubmitting}
            >
              Sign in
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
