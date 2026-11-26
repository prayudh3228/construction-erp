import { z } from 'zod';

/**
 * Branding config. These are neutral PLACEHOLDERS: the real company name and logo will be supplied
 * later (OPEN_QUESTIONS Q2) and will be stored in settings from Phase 4. Do not invent a brand.
 */
export const brandingSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  productName: z.string().trim().min(1).max(60),
  /** URL or path to the logo (SVG or PNG). Shown in a square box. */
  logoUrl: z.string().min(1),
});
export type Branding = z.infer<typeof brandingSchema>;

export const defaultBranding: Branding = {
  companyName: 'Your Company Name',
  productName: 'Construction ERP',
  logoUrl: '/placeholder-logo.svg',
};
