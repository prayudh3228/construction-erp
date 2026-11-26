import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { createStore, useStore } from '@/lib/store';

export type Connectivity = 'online' | 'offline' | 'unknown';

/**
 * Turn NetInfo's state into what the user needs to know. "Connected to Wi-Fi but no internet"
 * counts as offline. While NetInfo has not answered yet we say "unknown" and show no banner, so
 * the app never flashes "offline" on start.
 */
export function connectivityOf(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'> | null,
): Connectivity {
  if (!state || state.isConnected === null) return 'unknown';
  if (state.isConnected === false) return 'offline';
  if (state.isInternetReachable === false) return 'offline';
  return 'online';
}

/**
 * One app-wide value fed by ONE NetInfo listener, shared by every screen. It keeps the last known
 * value between screens, so opening a tab while offline shows the banner from the first frame.
 */
const connectivityStore = createStore<Connectivity>('unknown');
let users = 0;
let stopListening: (() => void) | null = null;

function startListening(): () => void {
  users += 1;
  if (users === 1) {
    stopListening = NetInfo.addEventListener((s) => connectivityStore.set(connectivityOf(s)));
  }
  return () => {
    users -= 1;
    if (users === 0) {
      stopListening?.();
      stopListening = null;
    }
  };
}

export function useConnectivity(): Connectivity {
  useEffect(startListening, []);
  return useStore(connectivityStore);
}
