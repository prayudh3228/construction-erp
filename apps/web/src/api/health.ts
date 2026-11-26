import { type HealthResponse, healthResponseSchema } from '@erp/shared';

/** Fetch API health and validate it against the shared schema. */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/health', { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`API answered ${res.status}`);
  return healthResponseSchema.parse(await res.json());
}
