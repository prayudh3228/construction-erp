import { type Branding, defaultBranding } from '@erp/shared';

/**
 * Branding source. Phase 1 returns the shared placeholders; Phase 4 loads the company's branding
 * from settings through this same hook, so components never read branding any other way.
 */
export function useBranding(): Branding {
  return defaultBranding;
}
