/**
 * Controllable NetInfo for tests: `setNetwork({ isConnected: false })` simulates going offline.
 * Wired up in jest.setup.ts.
 */
interface MockState {
  type: string;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

const ONLINE: MockState = { type: 'wifi', isConnected: true, isInternetReachable: true };
let state: MockState = { ...ONLINE };
const listeners = new Set<(s: MockState) => void>();

export function setNetwork(next: Partial<MockState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

export function resetNetwork(): void {
  state = { ...ONLINE };
  listeners.clear();
}

const NetInfo = {
  addEventListener(listener: (s: MockState) => void) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  },
  fetch: () => Promise.resolve(state),
  refresh: () => Promise.resolve(state),
};

export default NetInfo;
