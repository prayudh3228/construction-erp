import { type SessionInfo } from '@erp/shared';

/** Warn this long before the session ends. */
export const WARN_BEFORE_MS = 2 * 60_000;

/**
 * The server records activity at most once a minute, so its idle deadline can be up to a
 * minute earlier than "last request + idle timeout". Count down from the earlier time.
 */
export const SERVER_TOUCH_SLACK_MS = 60_000;

export type TimeoutState =
  | { kind: 'ok'; msLeft: number }
  /** Inactivity: "Stay signed in" extends it. */
  | { kind: 'warn-idle'; msLeft: number }
  /** The daily limit: cannot be extended, the user must sign in again. */
  | { kind: 'warn-absolute'; msLeft: number }
  | { kind: 'expired'; msLeft: 0 };

/**
 * Where the session stands, from the browser's side. The idle end is counted from the last
 * successful request (each one extends it on the server); the absolute end never moves.
 */
export function timeoutState(now: number, lastActivity: number, info: SessionInfo): TimeoutState {
  const idleEnd = lastActivity + info.idleTimeoutSeconds * 1000 - SERVER_TOUCH_SLACK_MS;
  const absoluteEnd = Date.parse(info.absoluteExpiresAt);
  const end = Math.min(idleEnd, absoluteEnd);
  const msLeft = end - now;
  if (msLeft <= 0) return { kind: 'expired', msLeft: 0 };
  if (msLeft > WARN_BEFORE_MS) return { kind: 'ok', msLeft };
  return { kind: absoluteEnd <= idleEnd ? 'warn-absolute' : 'warn-idle', msLeft };
}

/** "1:05" style countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
