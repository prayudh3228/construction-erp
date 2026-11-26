import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

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

export function useConnectivity(): Connectivity {
  const [connectivity, setConnectivity] = useState<Connectivity>('unknown');
  useEffect(() => NetInfo.addEventListener((s) => setConnectivity(connectivityOf(s))), []);
  return connectivity;
}
