import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { lastApiActivity, markApiActivity } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { type Session, authClient, clearSession, meQueryKey } from '../auth';
import { formatCountdown, timeoutState } from '../session-timeout';

/** When nothing has reached the server for this long, a page change counts as activity. */
const TOUCH_AFTER_MS = 5 * 60_000;

/**
 * Warns two minutes before the session ends and offers "Stay signed in". When the time is up,
 * returns to sign-in so nobody keeps working in a tab the server has already signed out.
 */
export function SessionTimeoutWarning({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const [now, setNow] = useState(() => Date.now());
  const [extending, setExtending] = useState(false);
  /** The daily-limit warning cannot be extended; once read, it stays closed until the end. */
  const [absoluteSeen, setAbsoluteSeen] = useState(false);

  // Moving between pages is real activity, but most pages do not call the API yet: tell the
  // server now and then, so clicking around the app is never mistaken for being away.
  useEffect(() => {
    if (Date.now() - lastApiActivity() < TOUCH_AFTER_MS) return;
    void authClient()
      .me()
      .then((me) => queryClient.setQueryData(meQueryKey, me));
  }, [href, queryClient]);

  // The server's own record of the last activity is a floor, in case nothing went through
  // apiFetch yet in this tab (e.g. the page was just opened).
  const serverLastSeen =
    Date.parse(session.info.idleExpiresAt) - session.info.idleTimeoutSeconds * 1000;
  const state = timeoutState(now, Math.max(lastApiActivity(), serverLastSeen), session.info);
  const warning = state.kind === 'warn-idle' || (state.kind === 'warn-absolute' && !absoluteSeen);

  // Tick once a second while warning, otherwise every 15 seconds.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), warning ? 1000 : 15_000);
    return () => window.clearInterval(id);
  }, [warning]);

  // Time is up by this browser's clock: confirm with the server before signing out, so a PC
  // whose clock is wrong never signs people out early.
  useEffect(() => {
    if (state.kind !== 'expired') return;
    let live = true;
    void authClient()
      .me()
      .catch(() => null)
      .then((me) => {
        if (!live) return;
        if (me) {
          markApiActivity();
          queryClient.setQueryData(meQueryKey, me);
          setNow(Date.now());
          return;
        }
        clearSession(queryClient);
        void navigate({ to: '/login', search: { reason: 'expired', redirect: href } });
      });
    return () => {
      live = false;
    };
  }, [state.kind, queryClient, navigate, href]);

  const stay = async () => {
    setExtending(true);
    try {
      const me = await authClient().me();
      if (me) markApiActivity();
      queryClient.setQueryData(meQueryKey, me);
      setNow(Date.now());
    } finally {
      setExtending(false);
    }
  };

  const signOutNow = async () => {
    await authClient()
      .logout()
      .catch(() => undefined);
    clearSession(queryClient);
    await navigate({ to: '/login', search: { reason: 'signed-out' } });
  };

  return (
    <Dialog open={warning}>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {state.kind === 'warn-absolute' ? (
          <>
            <DialogTitle>Your session is about to end</DialogTitle>
            <DialogDescription>
              For security you are signed out after a full working day. Save your work; you will
              need to sign in again in{' '}
              <span className="tabular font-semibold">{formatCountdown(state.msLeft)}</span>.
            </DialogDescription>
            <DialogFooter>
              <Button variant="outline" onClick={() => void signOutNow()}>
                Sign out now
              </Button>
              <Button onClick={() => setAbsoluteSeen(true)}>OK</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogTitle>Are you still there?</DialogTitle>
            <DialogDescription>
              You will be signed out in{' '}
              <span className="tabular font-semibold" aria-live="off">
                {formatCountdown(state.msLeft)}
              </span>{' '}
              because there has been no activity.
            </DialogDescription>
            <DialogFooter>
              <Button variant="outline" onClick={() => void signOutNow()}>
                Sign out
              </Button>
              <Button onClick={() => void stay()} loading={extending}>
                Stay signed in
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
