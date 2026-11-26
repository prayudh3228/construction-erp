import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PROBLEM_MESSAGES,
  type PasswordProblem,
  checkPassword,
} from '@erp/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Check, CircleX, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { isApiError } from '@/api/client';
import { authClient, clearSession, meQueryKey, useSession } from '@/app/auth';
import { useBranding } from '@/app/branding';
import { usePageTitle } from '@/app/page-title';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';

/** The rules shown as a live checklist while typing. */
const CHECKLIST: { problem: PasswordProblem; label: string }[] = [
  { problem: 'too_short', label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { problem: 'common', label: 'Not a common password' },
  { problem: 'repetitive', label: 'No repeated characters or simple sequences' },
  { problem: 'contains_personal_info', label: 'Does not contain your name, username or email' },
];

/**
 * Change your password. Standalone page (no menus): a user who must change their password
 * (first sign-in, or after an admin reset) cannot open anything else until they do.
 */
export function ChangePasswordPage() {
  usePageTitle('Change password');
  const branding = useBranding();
  const session = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(
    null,
  );

  if (!session) return null;
  const forced = session.user.mustChangePassword;
  const problems = checkPassword(next, session.user);
  const errors = {
    current: submitted && current === '' ? 'Enter your current password.' : undefined,
    next:
      submitted && problems.length > 0
        ? PASSWORD_PROBLEM_MESSAGES[problems[0]!]
        : submitted && next === current && next !== ''
          ? 'Choose a password different from your current one.'
          : undefined,
    confirm: submitted && confirm !== next ? 'The two new passwords do not match.' : undefined,
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    // Validate from the values themselves (the errors above are from the previous render).
    if (current === '' || problems.length > 0 || confirm !== next || next === current) return;
    setBusy(true);
    try {
      const me = await authClient().changePassword(current, next);
      queryClient.setQueryData(meQueryKey, me);
      toast.success('Your password has been changed. Other devices have been signed out.');
      await navigate({ to: '/' });
    } catch (err) {
      setServerError(
        isApiError(err)
          ? { message: err.message, details: err.details }
          : { message: 'Could not change your password. Please try again.', details: [] },
      );
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await authClient()
      .logout()
      .catch(() => undefined);
    clearSession(queryClient);
    await navigate({ to: '/login', search: { reason: 'signed-out' } });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2">
        <img src={branding.logoUrl} alt="" className="size-10 rounded-md" />
        <h1 className="text-2xl font-semibold tracking-tight">
          {forced ? 'Choose a new password' : 'Change password'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {forced
            ? `Welcome, ${session.user.name}. Please choose your own password before you continue.`
            : 'Other browsers and phones signed in as you will be signed out.'}
        </p>
      </div>

      <form
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-xs"
      >
        <FormField label="Current password" error={errors.current} required>
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </FormField>
        <FormField label="New password" error={errors.next} required>
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-describedby="password-rules"
          />
        </FormField>
        <ul id="password-rules" aria-label="Password rules" className="space-y-1 text-sm">
          {CHECKLIST.map(({ problem, label }) => {
            const ok = next !== '' && !problems.includes(problem);
            return (
              <li
                key={problem}
                className={cn(
                  'flex items-center gap-2',
                  ok ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {ok ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <X className="size-4" aria-hidden />
                )}
                <span>
                  {label}
                  <span className="sr-only">{ok ? ' (met)' : ' (not met yet)'}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <FormField label="Repeat new password" error={errors.confirm} required>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </FormField>

        {serverError && (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-danger/25 bg-danger-subtle p-3 text-sm text-danger-foreground"
          >
            <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p>{serverError.message}</p>
              {serverError.details.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {serverError.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {forced ? (
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => void navigate({ to: '/' })}>
              Cancel
            </Button>
          )}
          <Button type="submit" loading={busy}>
            Change password
          </Button>
        </div>
      </form>
    </main>
  );
}
