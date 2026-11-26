/**
 * Demo mode shows fake data and a one-click demo sign-in so the UI can be reviewed without setup.
 * On in development and in the local Docker stack (VITE_DEMO_MODE=true). It must be off for any
 * real deployment; Phase 2 adds real sign-in and Phase 34 removes demo mode from production builds.
 */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}
