import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusPage } from './StatusPage';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StatusPage />
    </QueryClientProvider>,
  );
}

const healthy = {
  status: 'ok',
  service: 'api',
  version: '0.0.0',
  time: '2026-03-31T20:00:00.000Z',
  checks: { database: 'up' },
};

function stubFetch(...responses: Array<() => Promise<Response>>) {
  const fn = vi.fn();
  for (const r of responses) fn.mockImplementationOnce(r);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('StatusPage', () => {
  it('shows a loading state first', () => {
    stubFetch(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Checking the server');
  });

  it('shows API and database status with an Indian-format date', async () => {
    stubFetch(async () => Response.json(healthy));
    renderPage();
    expect(await screen.findByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    // 31-03-2026 20:00 UTC is 01-04-2026 in India
    expect(screen.getByText('01-04-2026')).toBeInTheDocument();
  });

  it('shows degraded when the database is down', async () => {
    stubFetch(async () =>
      Response.json({ ...healthy, status: 'degraded', checks: { database: 'down' } }),
    );
    renderPage();
    expect(await screen.findByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  it('shows an error state and recovers on retry', async () => {
    const fetchMock = stubFetch(
      async () => new Response('down', { status: 502 }),
      async () => Response.json(healthy),
    );
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unreachable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Running')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a malformed response as an error', async () => {
    stubFetch(async () => Response.json({ hello: 'world' }));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
