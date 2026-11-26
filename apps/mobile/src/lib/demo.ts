/**
 * Demo mode: fake data and a one-click demo sign-in, so the app can be reviewed without setup.
 * EXPO_PUBLIC_DEMO_MODE is inlined at bundle time. Unset means ON in development builds and OFF
 * in release builds; "true"/"false" force it. Same rule as the web app (A19).
 */
export function isDemoMode(): boolean {
  const flag = process.env.EXPO_PUBLIC_DEMO_MODE;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}
