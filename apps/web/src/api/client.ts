import { CLIENT_HEADER, apiErrorSchema } from '@erp/shared';
import { type ZodType } from 'zod';

/** An API answer that was not 2xx, with the shared { code, message, details } body when present. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const isApiError = (e: unknown): e is ApiRequestError => e instanceof ApiRequestError;

let lastActivityAt = 0;

/**
 * When the server last saw this browser (any successful request). The session timeout warning
 * counts from here, because every request extends the server-side idle timer.
 */
export function lastApiActivity(): number {
  return lastActivityAt;
}

export function markApiActivity(at = Date.now()): void {
  lastActivityAt = Math.max(lastActivityAt, at);
}

/** Tests only: forget recorded activity between tests. */
export function resetApiActivity(): void {
  lastActivityAt = 0;
}

interface Options<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  schema?: ZodType<T>;
  signal?: AbortSignal;
}

/**
 * Call the API. Sends the session cookie (same origin) and the client header that the API
 * requires on every write (CSRF defence). Validates the answer when a schema is given.
 */
export async function apiFetch<T = void>(path: string, options: Options<T> = {}): Promise<T> {
  const { method = 'GET', body, schema, signal } = options;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        [CLIENT_HEADER]: 'web',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'Could not reach the server. Check your connection and try again.',
    );
  }

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(await res.json().catch(() => null));
    throw parsed.success
      ? new ApiRequestError(res.status, parsed.data.code, parsed.data.message, parsed.data.details)
      : new ApiRequestError(res.status, 'HTTP_ERROR', `The server answered ${res.status}.`);
  }

  markApiActivity();
  if (res.status === 204 || !schema) return undefined as T;
  return schema.parse(await res.json());
}
