import { formatDate } from '@erp/shared';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from './api/health';
import { branding } from './branding';

function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'bad'; children: string }) {
  const tones = {
    ok: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    warn: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    bad: 'bg-red-50 text-red-700 ring-red-600/20',
  } as const;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Phase 0 page: proves web -> API -> database is wired up. Replaced by the app shell in Phase 1. */
export function StatusPage() {
  const health = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => fetchHealth(signal) });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
      <header className="flex items-center gap-3">
        <img src={branding.logoUrl} alt="" className="h-10 w-10" />
        <div>
          <h1 className="text-xl font-semibold">{branding.productName}</h1>
          <p className="text-sm text-slate-500">{branding.companyName}</p>
        </div>
      </header>

      <section
        aria-labelledby="status-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id="status-heading" className="mb-4 text-base font-medium">
          System status
        </h2>

        {health.isPending && (
          <p role="status" className="text-slate-500">
            Checking the server…
          </p>
        )}

        {health.isError && (
          <div role="alert" className="space-y-3">
            <Badge tone="bad">Server unreachable</Badge>
            <p className="text-sm text-slate-600">
              The web app could not reach the API. Check that it is running, then try again.
            </p>
            <button
              type="button"
              onClick={() => void health.refetch()}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Try again
            </button>
          </div>
        )}

        {health.isSuccess && (
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-slate-500">API</dt>
            <dd>
              <Badge tone={health.data.status === 'ok' ? 'ok' : 'warn'}>
                {health.data.status === 'ok' ? 'Running' : 'Degraded'}
              </Badge>
            </dd>
            <dt className="text-slate-500">Database</dt>
            <dd>
              <Badge tone={health.data.checks.database === 'up' ? 'ok' : 'bad'}>
                {health.data.checks.database === 'up' ? 'Connected' : 'Not connected'}
              </Badge>
            </dd>
            <dt className="text-slate-500">Version</dt>
            <dd>{health.data.version}</dd>
            <dt className="text-slate-500">Checked on</dt>
            <dd>{formatDate(new Date(health.data.time))}</dd>
          </dl>
        )}
      </section>
    </main>
  );
}
