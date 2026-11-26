/** Signed-in screens a sign-in may return to (deep links such as constructionerp:///sync). */
export const SIGNED_IN_ROUTES = ['/', '/capture', '/sync', '/more'] as const;
export type SignedInRoute = (typeof SIGNED_IN_ROUTES)[number];

/** Where to go after sign-in: only a known signed-in screen, never login or anything else. */
export function safeNextRoute(value: unknown): SignedInRoute {
  const v = Array.isArray(value) ? value[0] : value;
  return (SIGNED_IN_ROUTES as readonly unknown[]).includes(v) ? (v as SignedInRoute) : '/';
}
