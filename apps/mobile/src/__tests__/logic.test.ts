import { lightColors, tokens } from '@erp/shared';
import { isDemoMode } from '@/lib/demo';
import { connectivityOf } from '@/state/network';
import { type SyncStatus, describeSync } from '@/state/sync';
import { PRIMARY_TOUCH_TARGET, TOUCH_TARGET, colors, space, text } from '@/theme';

const idle: SyncStatus = { pending: 0, state: 'idle', lastSyncedAt: null };

describe('connectivityOf', () => {
  it.each([
    [null, 'unknown'],
    [{ isConnected: null, isInternetReachable: null }, 'unknown'],
    [{ isConnected: false, isInternetReachable: null }, 'offline'],
    // Joined to Wi-Fi with no internet behind it: offline for our purposes.
    [{ isConnected: true, isInternetReachable: false }, 'offline'],
    // Reachability not known yet but connected: treat as online, don't flash a warning.
    [{ isConnected: true, isInternetReachable: null }, 'online'],
    [{ isConnected: true, isInternetReachable: true }, 'online'],
  ] as const)('%j -> %s', (state, expected) => {
    expect(connectivityOf(state)).toBe(expected);
  });
});

describe('describeSync', () => {
  it('offline with nothing waiting', () => {
    expect(describeSync(idle, 'offline')).toMatchObject({ label: 'Offline', tone: 'warning' });
  });

  it('offline with items waiting counts them, singular and plural', () => {
    const one = describeSync({ ...idle, pending: 1 }, 'offline');
    expect(one.label).toBe('1 waiting');
    expect(one.description).toContain('1 item saved');
    expect(describeSync({ ...idle, pending: 3 }, 'offline').description).toContain('3 items saved');
  });

  it('offline wins over syncing and error (the phone cannot be sending)', () => {
    expect(describeSync({ ...idle, state: 'syncing', pending: 2 }, 'offline').label).toBe(
      '2 waiting',
    );
    expect(describeSync({ ...idle, state: 'error' }, 'offline').label).toBe('Offline');
  });

  it('syncing, failed, waiting, never synced and up to date', () => {
    expect(describeSync({ ...idle, state: 'syncing', pending: 2 }, 'online')).toMatchObject({
      label: 'Syncing…',
      tone: 'info',
    });
    expect(describeSync({ ...idle, state: 'error', pending: 2 }, 'online')).toMatchObject({
      label: 'Sync failed',
      tone: 'danger',
    });
    expect(describeSync({ ...idle, state: 'error' }, 'online').description).toBe(
      'The last sync failed. Try again.',
    );
    expect(describeSync({ ...idle, pending: 4 }, 'online').label).toBe('4 to send');
    expect(describeSync(idle, 'online')).toMatchObject({
      label: 'Not synced yet',
      tone: 'neutral',
    });
    expect(describeSync({ ...idle, lastSyncedAt: '2026-11-26T10:00:00Z' }, 'online')).toMatchObject(
      { label: 'Up to date', tone: 'success' },
    );
  });

  it('unknown connectivity behaves like online (no false offline warning)', () => {
    expect(describeSync(idle, 'unknown').label).toBe('Not synced yet');
  });
});

describe('mobile theme', () => {
  it('uses exactly the shared light colours, so branding changes reach the phone', () => {
    expect(colors).toBe(lightColors);
  });

  it('touch targets meet platform minimums', () => {
    expect(TOUCH_TARGET).toBeGreaterThanOrEqual(48);
    expect(PRIMARY_TOUCH_TARGET).toBeGreaterThan(TOUCH_TARGET);
  });

  it('body text is at least 17dp for reading outdoors, larger than the web base', () => {
    expect(text.body.fontSize).toBeGreaterThanOrEqual(17);
    expect(text.body.fontSize).toBeGreaterThan(tokens.typography.scale.base[0]);
  });

  it('spacing follows the shared 4-point grid', () => {
    expect(space(4)).toBe(16);
    expect(space(1.5)).toBe(6);
  });
});

describe('isDemoMode', () => {
  it('follows the explicit flag, otherwise development builds only', () => {
    process.env.EXPO_PUBLIC_DEMO_MODE = 'true';
    expect(isDemoMode()).toBe(true);
    process.env.EXPO_PUBLIC_DEMO_MODE = 'false';
    expect(isDemoMode()).toBe(false);
    delete process.env.EXPO_PUBLIC_DEMO_MODE;
    // Jest runs as a development build (__DEV__ is true).
    expect(isDemoMode()).toBe(__DEV__);
  });
});
