/**
 * Where to go after sign-in. Only same-site paths are allowed, so a crafted link such as
 * `/login?redirect=https://evil.example` or `//evil.example` cannot send the user off-site.
 */
export function safeRedirectPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  // Control characters (tabs, newlines) can be stripped by browsers into "//": refuse them.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/login/')) {
    return fallback;
  }
  return value;
}
