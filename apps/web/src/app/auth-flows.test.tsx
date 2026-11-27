import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '@/api/client';
import { setProjectsSource } from '@/data/projects';
import { FAKE_PASSWORD, fakeAuth, fakeMe, signIn } from '@/test/fake-auth';
import { currentUrl, renderApp } from '@/test/render-app';
import { WARN_BEFORE_MS, formatCountdown, timeoutState } from './session-timeout';

const MIN = 60_000;

describe('timeoutState', () => {
  const start = Date.parse('2026-11-26T04:30:00Z');
  const info = {
    idleExpiresAt: new Date(start + 30 * MIN).toISOString(),
    absoluteExpiresAt: new Date(start + 12 * 60 * MIN).toISOString(),
    idleTimeoutSeconds: 30 * 60,
  };

  it('ok until 2 minutes before the idle end, then warns, then expires', () => {
    // Last request at start, 30 min idle, minus 1 min because the server records activity at
    // most once a minute: the browser counts down to start + 29 min.
    expect(timeoutState(start + 26 * MIN, start, info)).toEqual({ kind: 'ok', msLeft: 3 * MIN });
    expect(timeoutState(start + 27 * MIN, start, info)).toEqual({
      kind: 'warn-idle',
      msLeft: WARN_BEFORE_MS,
    });
    expect(timeoutState(start + 28.5 * MIN, start, info).kind).toBe('warn-idle');
    expect(timeoutState(start + 29 * MIN, start, info)).toEqual({ kind: 'expired', msLeft: 0 });
  });

  it('activity moves the idle end; the 12-hour end never moves', () => {
    const lastActivity = start + 11 * 60 * MIN + 50 * MIN; // 10 min before the 12 h limit
    // Idle end would be 20 min after the absolute end, so the absolute end wins.
    expect(timeoutState(start + 12 * 60 * MIN - MIN, lastActivity, info)).toEqual({
      kind: 'warn-absolute',
      msLeft: MIN,
    });
    expect(timeoutState(start + 12 * 60 * MIN, lastActivity, info).kind).toBe('expired');
  });

  it('formats the countdown as m:ss, rounding up', () => {
    expect(formatCountdown(120_000)).toBe('2:00');
    expect(formatCountdown(61_001)).toBe('1:02');
    expect(formatCountdown(500)).toBe('0:01');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('must change password', () => {
  it('any page sends the user to choose a new password first', async () => {
    signIn(undefined, 'New Starter', { mustChangePassword: true });
    const { router } = renderApp('/finance');
    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/change-password');
    // No menus: nothing else can be opened from here.
    expect(screen.queryByRole('navigation', { name: 'Departments' })).not.toBeInTheDocument();
  });

  it('shows the rules as a live checklist and checks the repeat', async () => {
    signIn(undefined, 'Asha Rao', { mustChangePassword: true, username: 'asha.rao' });
    const { user } = renderApp('/change-password');
    const rules = await screen.findByRole('list', { name: 'Password rules' });
    await user.type(screen.getByLabelText(/^New password/), 'asha.rao lantern');
    expect(within(rules).getByText(/Does not contain your name/)).toHaveTextContent(
      '(not met yet)',
    );
    expect(within(rules).getByText(/At least 12 characters/)).toHaveTextContent('(met)');

    await user.clear(screen.getByLabelText(/^New password/));
    await user.type(screen.getByLabelText(/^New password/), 'brand new lantern 58');
    await user.type(screen.getByLabelText(/Current password/), FAKE_PASSWORD);
    await user.type(screen.getByLabelText(/Repeat new password/), 'brand new lantern 59');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByText('The two new passwords do not match.')).toBeInTheDocument();
    expect(fakeAuth.changePassword).not.toHaveBeenCalled();
  });

  it('after changing it, the app opens normally', async () => {
    signIn(undefined, 'New Starter', { mustChangePassword: true });
    const { user, router } = renderApp('/change-password');
    await user.type(await screen.findByLabelText(/Current password/), FAKE_PASSWORD);
    await user.type(screen.getByLabelText(/^New password/), 'brand new lantern 58');
    await user.type(screen.getByLabelText(/Repeat new password/), 'brand new lantern 58');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await screen.findByRole('heading', { level: 1, name: 'Management dashboard' });
    expect(fakeAuth.changePassword).toHaveBeenCalledWith(FAKE_PASSWORD, 'brand new lantern 58');
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('shows the server’s reasons when it refuses the new password', async () => {
    signIn(undefined, 'New Starter', { mustChangePassword: true });
    const { user } = renderApp('/change-password');
    await user.type(await screen.findByLabelText(/Current password/), FAKE_PASSWORD);
    await user.type(screen.getByLabelText(/^New password/), 'server-says-no lantern');
    await user.type(screen.getByLabelText(/Repeat new password/), 'server-says-no lantern');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Choose a stronger password.');
    expect(alert).toHaveTextContent('The server found a problem.');
  });

  it('can also be opened from the account menu, with Cancel back to the app', async () => {
    signIn(undefined, 'Asha Rao');
    const { user, router } = renderApp('/finance');
    await screen.findByRole('heading', { level: 1, name: 'Accounts and finance' });
    await user.click(screen.getByRole('button', { name: 'Account menu for Asha Rao' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Change password' }));
    expect(await screen.findByRole('heading', { name: 'Change password' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/change-password'));
  });
});

describe('session ending mid-use', () => {
  it('a 401 from any request returns to sign-in, explaining why and remembering the page', async () => {
    signIn();
    setProjectsSource({
      list: () =>
        Promise.reject(new ApiRequestError(401, 'SESSION_EXPIRED', 'Your session has ended.')),
    });
    const { router } = renderApp('/finance?project=PRJ-001');
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.getByRole('status')).toHaveTextContent(/session ended/);
    expect(router.state.location.search).toMatchObject({
      reason: 'expired',
      redirect: '/finance?project=PRJ-001',
    });
  });

  it('when the server cannot be reached at all, says so and offers a retry', async () => {
    fakeAuth.meError = new ApiRequestError(0, 'NETWORK_ERROR', 'Could not reach the server.');
    const { user } = renderApp('/finance');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.');
    signIn();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Accounts and finance' }),
    ).toBeInTheDocument();
  });
});

describe('session timeout warning', () => {
  it('warns before the idle limit and "Stay signed in" asks the server to extend it', async () => {
    // The server last saw this session 28 minutes ago: about a minute left on our countdown.
    const lastSeen = Date.now() - 28 * MIN;
    fakeAuth.current = fakeMe(
      { displayName: 'Asha Rao' },
      { idleExpiresAt: new Date(lastSeen + 30 * MIN).toISOString() },
    );
    const { user } = renderApp('/finance');
    const dialog = await screen.findByRole('dialog', { name: 'Are you still there?' });
    expect(dialog).toHaveTextContent(/signed out in [01]:\d\d/);

    fakeAuth.current = fakeMe({ displayName: 'Asha Rao' }); // the server extends it
    const callsBefore = fakeAuth.me.mock.calls.length;
    await user.click(within(dialog).getByRole('button', { name: 'Stay signed in' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fakeAuth.me.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('"Stay signed in" after the server already ended the session goes to sign-in, not a blank page', async () => {
    const lastSeen = Date.now() - 28 * MIN;
    fakeAuth.current = fakeMe({}, { idleExpiresAt: new Date(lastSeen + 30 * MIN).toISOString() });
    const { user, router } = renderApp('/finance');
    const dialog = await screen.findByRole('dialog', { name: 'Are you still there?' });
    fakeAuth.current = null; // the server ended it a moment ago
    await user.click(within(dialog).getByRole('button', { name: 'Stay signed in' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.search).toMatchObject({ reason: 'expired', redirect: '/finance' });
  });

  it('when time is up and the server agrees, returns to sign-in', async () => {
    const lastSeen = Date.now() - 31 * MIN;
    fakeAuth.current = fakeMe({}, { idleExpiresAt: new Date(lastSeen + 30 * MIN).toISOString() });
    const { router } = renderApp('/finance');
    // The first check loads the (already stale) session; then the server says it is gone.
    fakeAuth.me.mockResolvedValue(null);
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(router.state.location.search).toMatchObject({ reason: 'expired' });
  });

  it('a wrong PC clock never signs anyone out while the server says the session is fine', async () => {
    const lastSeen = Date.now() - 31 * MIN;
    fakeAuth.current = fakeMe({}, { idleExpiresAt: new Date(lastSeen + 30 * MIN).toISOString() });
    const { router } = renderApp('/finance');
    // The server still has a valid session (its clock disagrees with ours).
    await waitFor(() => expect(fakeAuth.me.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Accounts and finance' }),
    ).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/finance');
  });
});
