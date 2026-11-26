import { z } from 'zod';

/**
 * Login form shape, shared by web, mobile and (from Phase 2) the API. Only "is it filled in" rules
 * live here; password strength rules are for setting a password, not for signing in.
 */
export const loginFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Enter your username or email.')
    .max(120, 'That is too long for a username or email.'),
  password: z.string().min(1, 'Enter your password.').max(200, 'That is too long for a password.'),
});
export type LoginForm = z.infer<typeof loginFormSchema>;
