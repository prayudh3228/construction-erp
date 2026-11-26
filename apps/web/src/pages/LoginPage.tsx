import { type LoginForm, loginFormSchema } from '@erp/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useBranding } from '@/app/branding';
import { safeRedirectPath } from '@/app/redirect';
import { startDemoSession } from '@/app/session';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { isDemoMode } from '@/lib/env';

const route = getRouteApi('/login');

export function LoginPage() {
  const branding = useBranding();
  const navigate = useNavigate();
  const { redirect } = route.useSearch();
  const demo = isDemoMode();
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginFormSchema),
    mode: 'onTouched',
    defaultValues: { username: '', password: '' },
  });

  const goIn = () => {
    startDemoSession();
    toast.success('Signed in as the demo user.');
    void navigate({ href: safeRedirectPath(redirect) });
  };

  // Phase 2 replaces this with the real sign-in call. Until then no password is accepted.
  const onSubmit = handleSubmit(() => {
    setNotice(
      demo
        ? 'Password sign-in is switched on in the next phase. For now, use "Continue as demo user".'
        : 'Password sign-in is not switched on yet.',
    );
  });

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

          {demo && (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-xs">
              <p className="text-sm text-muted-foreground">
                This is a demo with fake data. No password is needed.
              </p>
              <Button size="lg" className="w-full" onClick={goIn}>
                Continue as demo user
              </Button>
            </div>
          )}

          <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <FormField label="Username or email" error={errors.username?.message} required>
              <Input autoComplete="username" autoCapitalize="none" {...register('username')} />
            </FormField>
            <FormField label="Password" error={errors.password?.message} required>
              <Input type="password" autoComplete="current-password" {...register('password')} />
            </FormField>
            {notice && (
              <div
                role="status"
                className="flex gap-2 rounded-lg border border-info/25 bg-info-subtle p-3 text-sm text-info-foreground"
              >
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>{notice}</p>
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
