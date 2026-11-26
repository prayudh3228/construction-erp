import { createStore, useStore } from '@/lib/store';
import { type Connectivity } from './network';

/**
 * What the sync queue reports. PLACEHOLDER: the real offline queue (SQLite, no duplicates,
 * conflict handling) arrives in Phase 28 and will drive this same shape.
 */
export interface SyncStatus {
  /** Records saved on the phone and not yet accepted by the server. */
  pending: number;
  state: 'idle' | 'syncing' | 'error';
  /** ISO instant of the last successful sync, or null if never. */
  lastSyncedAt: string | null;
}

const INITIAL: SyncStatus = { pending: 0, state: 'idle', lastSyncedAt: null };
export const syncStore = createStore<SyncStatus>(INITIAL);
export const resetSyncStatus = () => syncStore.set(INITIAL);
export const useSyncStatus = () => useStore(syncStore);

export type SyncTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface SyncSummary {
  /** Short text for the pill in every screen header. */
  label: string;
  /** Longer sentence for screen readers and the Sync screen. */
  description: string;
  tone: SyncTone;
}

const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

/** One place that decides what the sync pill says, so every screen says the same thing. */
export function describeSync(status: SyncStatus, connectivity: Connectivity): SyncSummary {
  const { pending, state, lastSyncedAt } = status;
  if (connectivity === 'offline') {
    return pending > 0
      ? {
          label: `${pending} waiting`,
          description: `Offline. ${items(pending)} saved on this phone will be sent when you are back online.`,
          tone: 'warning',
        }
      : {
          label: 'Offline',
          description: 'Offline. You can keep working; new entries are saved on this phone.',
          tone: 'warning',
        };
  }
  if (state === 'syncing') {
    return {
      label: 'Syncing…',
      description: `Sending ${items(pending)} to the office.`,
      tone: 'info',
    };
  }
  if (state === 'error') {
    return {
      label: 'Sync failed',
      description:
        pending > 0
          ? `Could not send ${items(pending)}. They are safe on this phone and will be sent again.`
          : 'The last sync failed. It will try again by itself.',
      tone: 'danger',
    };
  }
  if (pending > 0) {
    return {
      label: `${pending} to send`,
      description: `${items(pending)} waiting to be sent.`,
      tone: 'info',
    };
  }
  if (lastSyncedAt === null) {
    return {
      label: 'Not synced yet',
      description: 'Nothing has been synced from this phone yet.',
      tone: 'neutral',
    };
  }
  return {
    label: 'Up to date',
    description: 'Everything on this phone has been sent.',
    tone: 'success',
  };
}
