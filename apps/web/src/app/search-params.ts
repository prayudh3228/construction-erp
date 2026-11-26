/**
 * URL query handling for the router. TanStack Router's default JSON-parses every value, so
 * `?project=1e3` would become the number 1000 and `?project=true` a boolean, and plain strings
 * that look like numbers get re-written with quotes. Our query values are always plain strings,
 * so they are read and written as-is.
 */
export function parseSearch(searchStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr);
  for (const [key, value] of params) {
    if (!(key in out)) out[key] = value; // First value wins for repeated keys.
  }
  return out;
}

export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}
