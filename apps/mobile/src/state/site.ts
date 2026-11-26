import { createStore, useStore } from '@/lib/store';

/**
 * The project (site) the user is working on today. Site staff usually stay on one site, so the
 * phone keeps a single current site instead of the web's All/Company-wide views. In memory for
 * now; Phase 28 stores it on the phone with the offline data.
 */
export const currentSiteStore = createStore<string | null>(null);

export const useCurrentSiteId = () => useStore(currentSiteStore);
