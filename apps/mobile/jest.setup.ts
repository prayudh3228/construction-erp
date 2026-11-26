import { cleanup } from '@testing-library/react-native';
import { demoProjectsSource, setProjectsSource } from '@/data/projects';
import { sessionStore } from '@/state/session';
import { currentSiteStore } from '@/state/site';
import { syncStore } from '@/state/sync';
import { resetNetwork } from '@/test/netinfo-mock';

jest.mock('@react-native-community/netinfo', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('./src/test/netinfo-mock');
  return { __esModule: true, ...mock };
});

afterEach(() => {
  // Unmount first, so resetting the shared stores below cannot update a mounted screen outside act().
  cleanup();
  sessionStore.set(null);
  currentSiteStore.set(null);
  syncStore.set({ pending: 0, state: 'idle', lastSyncedAt: null });
  setProjectsSource(demoProjectsSource);
  resetNetwork();
  delete process.env.EXPO_PUBLIC_DEMO_MODE;
});
