/**
 * Small wrappers around Web Storage that never throw (private mode, blocked storage, quota).
 * Only for conveniences such as a collapsed sidebar; never for anything that must persist.
 */
type Area = 'local' | 'session';

function area(kind: Area): Storage | undefined {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function readStorage(kind: Area, key: string): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(kind: Area, key: string, value: string | null): void {
  try {
    const s = area(kind);
    if (!s) return;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // Storage unavailable: the app keeps working without remembering.
  }
}
