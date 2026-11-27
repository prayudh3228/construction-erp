import { meResponseSchema } from '@erp/shared';
import { describe, expect, it, vi } from 'vitest';
import { httpAuthClient } from '@/app/auth';
import { fakeMe } from '@/test/fake-auth';
import { ApiRequestError, apiFetch, lastApiActivity } from './client';

function stubFetch(response: Response | Error) {
  const fn = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('apiFetch', () => {
  it('sends the session cookie, the client header and JSON, under /api', async () => {
    const fetchMock = stubFetch(Response.json(fakeMe()));
    await apiFetch('/auth/login', { method: 'POST', body: { a: 1 }, schema: meResponseSchema });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).toMatchObject({
      'x-erp-client': 'web',
      'Content-Type': 'application/json',
    });
    expect(init.body).toBe('{"a":1}');
  });

  it('turns an error body into an ApiRequestError with code, message and details', async () => {
    stubFetch(
      Response.json(
        {
          statusCode: 400,
          code: 'WEAK_PASSWORD',
          message: 'Choose a stronger password.',
          details: ['x'],
        },
        { status: 400 },
      ),
    );
    await expect(
      apiFetch('/auth/change-password', { method: 'POST', body: {} }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'WEAK_PASSWORD',
      message: 'Choose a stronger password.',
      details: ['x'],
    });
  });

  it('copes with an error that is not JSON (e.g. a proxy page)', async () => {
    stubFetch(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(apiFetch('/auth/me')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });

  it('reports a network failure in plain words', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    const error = await apiFetch('/auth/me').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('records activity only on success, and accepts 204 with no body', async () => {
    const before = lastApiActivity();
    stubFetch(new Response('{}', { status: 401 }));
    await apiFetch('/auth/me').catch(() => undefined);
    expect(lastApiActivity()).toBe(before);
    stubFetch(new Response(null, { status: 204 }));
    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
    expect(lastApiActivity()).toBeGreaterThan(before);
  });

  it('rejects an answer that does not match the expected shape', async () => {
    stubFetch(Response.json({ user: 'nope' }));
    await expect(apiFetch('/auth/me', { schema: meResponseSchema })).rejects.toThrow();
  });
});

describe('httpAuthClient.me', () => {
  it('treats 401 as "signed out" (null), not as an error', async () => {
    stubFetch(
      Response.json(
        { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Please sign in.' },
        { status: 401 },
      ),
    );
    await expect(httpAuthClient.me()).resolves.toBeNull();
  });

  it('passes other failures on, so the app can show "server unreachable"', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    await expect(httpAuthClient.me()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
