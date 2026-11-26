import { type ProjectSummary } from '@erp/shared';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import CaptureScreen from '@/app/(tabs)/capture';
import TabsLayout from '@/app/(tabs)/_layout';
import TodayScreen from '@/app/(tabs)/index';
import MoreScreen from '@/app/(tabs)/more';
import SyncScreen from '@/app/(tabs)/sync';
import RootLayout from '@/app/_layout';
import LoginScreen from '@/app/login';
import { setProjectsSource } from '@/data/projects';
import { sessionStore, startDemoSession } from '@/state/session';
import { currentSiteStore } from '@/state/site';
import { syncStore } from '@/state/sync';
import { setNetwork } from '@/test/netinfo-mock';
import { TOUCH_TARGET } from '@/theme';

const ROUTES = {
  _layout: RootLayout,
  login: LoginScreen,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': TodayScreen,
  '(tabs)/capture': CaptureScreen,
  '(tabs)/sync': SyncScreen,
  '(tabs)/more': MoreScreen,
};

const renderApp = (initialUrl = '/') => renderRouter(ROUTES, { initialUrl });

describe('sign-in', () => {
  it('a signed-out user lands on the login screen', async () => {
    await renderApp('/');
    expect(await screen.findByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/login');
  });

  it('validates both fields inline with the shared rules', async () => {
    await renderApp('/login');
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your username or email.')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password.')).toBeOnTheScreen();
    // Typing clears that field's error.
    await fireEvent.changeText(screen.getByLabelText('Username or email, required'), 'asha');
    expect(screen.queryByText('Enter your username or email.')).not.toBeOnTheScreen();
  });

  it('does not accept a password yet, and says so', async () => {
    await renderApp('/login');
    await fireEvent.changeText(await screen.findByLabelText('Username or email, required'), 'asha');
    await fireEvent.changeText(screen.getByLabelText('Password, required'), 'secret');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/next phase/)).toBeOnTheScreen();
    expect(sessionStore.get()).toBeNull();
    expect(screen).toHavePathname('/login');
  });

  it('demo sign-in opens Today', async () => {
    await renderApp('/login');
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue as demo user' }));
    expect(await screen.findByText('Hello, Demo')).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
  });

  it('outside demo mode there is no demo button', async () => {
    process.env.EXPO_PUBLIC_DEMO_MODE = 'false';
    await renderApp('/login');
    await screen.findByRole('button', { name: 'Sign in' });
    expect(screen.queryByRole('button', { name: 'Continue as demo user' })).not.toBeOnTheScreen();
  });

  it('every button on the login screen is at least 48dp tall', async () => {
    await renderApp('/login');
    const buttons = await screen.findAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const b of buttons) {
      expect(StyleSheet.flatten(b.props.style).minHeight).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
  });
});

describe('tabs', () => {
  beforeEach(() => {
    startDemoSession();
  });

  it('shows the four tabs and switches between them', async () => {
    await renderApp('/');
    await screen.findByText('Hello, Demo');
    for (const [tab, heading, path] of [
      ['Capture', 'Take a photo first, add details after', '/capture'],
      ['Sync', 'Waiting to send', '/sync'],
      ['More', 'Office departments', '/more'],
      ['Today', 'Site actions', '/'],
    ] as const) {
      await fireEvent.press(screen.getByLabelText(tab));
      expect(await screen.findByText(heading)).toBeOnTheScreen();
      expect(screen).toHavePathname(path);
    }
  });

  it('site actions say which phase they arrive in and are marked unavailable', async () => {
    await renderApp('/');
    const tile = await screen.findByLabelText('Mark attendance. Coming in phase 28.');
    expect(tile).toBeDisabled();
  });

  it('choosing a site shows it on Today', async () => {
    await renderApp('/');
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose site' }));
    await fireEvent.press(
      await screen.findByRole('radio', { name: /PRJ-003 District Hospital Annexe/ }),
    );
    expect(await screen.findByText('District Hospital Annexe')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Change site' })).toBeOnTheScreen();
  });

  it('shows an error with retry when sites fail to load, then recovers', async () => {
    const site: ProjectSummary = {
      id: 'PRJ-010',
      code: 'PRJ-010',
      name: 'Test Site',
      type: 'contract',
      status: 'active',
      city: 'Pune',
    };
    const list = jest
      .fn<Promise<ProjectSummary[]>, []>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue([site]);
    setProjectsSource({ list });
    await renderApp('/');
    expect(await screen.findByText('Could not load your sites')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose site' }));
    expect(await screen.findByRole('radio', { name: /Test Site/ })).toBeOnTheScreen();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('says so when no sites are assigned', async () => {
    setProjectsSource({ list: () => Promise.resolve([]) });
    await renderApp('/');
    expect(await screen.findByText('No sites assigned yet')).toBeOnTheScreen();
  });

  it('More lists the office departments and signs out back to login', async () => {
    await renderApp('/more');
    expect(await screen.findByText('Accounts and finance')).toBeOnTheScreen();
    expect(screen.getByText('Demo data')).toBeOnTheScreen();
    await act(async () => {
      currentSiteStore.set('PRJ-001');
      syncStore.set({ pending: 2, state: 'error', lastSyncedAt: null });
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(sessionStore.get()).toBeNull();
    // Nothing of this user's is left for the next person on the phone.
    expect(currentSiteStore.get()).toBeNull();
    expect(syncStore.get()).toEqual({ pending: 0, state: 'idle', lastSyncedAt: null });
  });
});

describe('review fixes', () => {
  it('a deep link opened while signed out returns there after sign-in', async () => {
    await renderApp('/sync');
    await screen.findByRole('header', { name: 'Sign in' });
    expect(screen).toHavePathname('/login');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue as demo user' }));
    expect(await screen.findByText('Waiting to send')).toBeOnTheScreen();
    expect(screen).toHavePathname('/sync');
  });

  it('an unknown "next" target falls back to Today', async () => {
    await renderApp('/login?next=%2F%2Fevil');
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue as demo user' }));
    expect(await screen.findByText('Hello, Demo')).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
  });

  it('the screen reader announces going offline and login errors (iOS and Android)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderApp('/login');
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Enter your username or email.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue as demo user' }));
    await screen.findByText('Hello, Demo');
    await act(async () => setNetwork({ isConnected: false }));
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^You are offline/)),
    );
    announce.mockRestore();
  });

  it('a newly opened tab shows the offline banner from its first render', async () => {
    startDemoSession();
    await renderApp('/');
    await screen.findByText('Hello, Demo');
    await act(async () => setNetwork({ isConnected: false }));
    await screen.findByText(/You are offline/);
    await fireEvent.press(screen.getByLabelText('More'));
    // getAllBy (not findBy): it must already be there, with no "Checking…" frame in between.
    expect(screen.getAllByText(/You are offline/).length).toBeGreaterThan(0);
  });

  it('Sync now is never an enabled button that does nothing', async () => {
    startDemoSession();
    syncStore.set({ pending: 2, state: 'idle', lastSyncedAt: null });
    await renderApp('/sync');
    expect(await screen.findByText(/Sending by hand arrives in phase 28/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
  });

  it('after a failed sync the screen does not ask the user to retry by hand', async () => {
    startDemoSession();
    syncStore.set({ pending: 0, state: 'error', lastSyncedAt: null });
    await renderApp('/sync');
    expect(
      await screen.findAllByText('The last sync failed. It will try again by itself.'),
    ).not.toHaveLength(0);
    expect(screen.queryByText('Nothing is waiting to be sent.')).not.toBeOnTheScreen();
  });

  it('while syncing, the button shows it is busy and says why', async () => {
    startDemoSession();
    syncStore.set({ pending: 1, state: 'syncing', lastSyncedAt: null });
    await renderApp('/sync');
    expect(await screen.findByText('Sending now…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeBusy();
  });
});

describe('offline banner and sync status', () => {
  beforeEach(() => {
    startDemoSession();
  });

  it('online: no banner, and the pill says nothing has synced yet', async () => {
    await renderApp('/');
    await screen.findByText('Hello, Demo');
    expect(screen.queryByText(/You are offline/)).not.toBeOnTheScreen();
    expect(screen.getByText('Not synced yet')).toBeOnTheScreen();
  });

  it('going offline shows the banner and the pill on every screen, and back online clears it', async () => {
    await renderApp('/');
    await screen.findByText('Hello, Demo');
    await act(async () => setNetwork({ isConnected: false }));
    expect(await screen.findByText(/You are offline/)).toBeOnTheScreen();
    expect(screen.getByText('Offline')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Capture'));
    await screen.findByText('Take a photo first, add details after');
    expect(screen.getByText(/You are offline/)).toBeOnTheScreen();

    await act(async () => setNetwork({ isConnected: true, isInternetReachable: true }));
    await waitFor(() => expect(screen.queryByText(/You are offline/)).not.toBeOnTheScreen());
  });

  it('Wi-Fi without internet counts as offline', async () => {
    await renderApp('/');
    await screen.findByText('Hello, Demo');
    await act(async () => setNetwork({ isConnected: true, isInternetReachable: false }));
    expect(await screen.findByText(/You are offline/)).toBeOnTheScreen();
  });

  it('the pill counts waiting items and opens the Sync screen', async () => {
    syncStore.set({ pending: 3, state: 'idle', lastSyncedAt: null });
    await renderApp('/');
    await fireEvent.press(
      await screen.findByRole('button', { name: /Sync status: 3 items waiting/ }),
    );
    expect(await screen.findByText('Waiting to send')).toBeOnTheScreen();
    expect(screen).toHavePathname('/sync');
    expect(screen.getByLabelText('Waiting to send: 3')).toBeOnTheScreen();
  });

  it('Sync now is unavailable offline, and explains why', async () => {
    syncStore.set({ pending: 2, state: 'idle', lastSyncedAt: null });
    await renderApp('/sync');
    await screen.findByText('Waiting to send');
    await act(async () => setNetwork({ isConnected: false }));
    expect(
      await screen.findByText(/Sync starts by itself when you are back online/),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
  });

  it('Sync now is unavailable when nothing is waiting', async () => {
    await renderApp('/sync');
    expect(await screen.findByText('Nothing is waiting to be sent.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
    expect(screen.getByLabelText('Last synced: Never')).toBeOnTheScreen();
  });
});
