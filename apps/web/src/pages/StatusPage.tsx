import { formatDate } from '@erp/shared';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { fetchHealth } from '@/api/health';
import { useBranding } from '@/app/branding';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Public system status (web -> API -> database). Linked from the account menu. */
export function StatusPage() {
  const branding = useBranding();
  const health = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => fetchHealth(signal) });

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
      <header className="flex items-center gap-3">
        <img src={branding.logoUrl} alt="" className="size-10 rounded-md" />
        <div>
          <h1 className="text-xl font-semibold">{branding.productName}</h1>
          <p className="text-sm text-muted-foreground">{branding.companyName}</p>
        </div>
      </header>

      <Card aria-labelledby="status-heading">
        <CardHeader>
          <CardTitle id="status-heading">System status</CardTitle>
        </CardHeader>
        <CardContent>
          {health.isPending && (
            <p role="status" className="text-muted-foreground">
              Checking the server…
            </p>
          )}

          {health.isError && (
            <div role="alert" className="space-y-3">
              <Badge tone="danger">Server unreachable</Badge>
              <p className="text-sm text-muted-foreground">
                The web app could not reach the API. Check that it is running, then try again.
              </p>
              <Button onClick={() => void health.refetch()} loading={health.isFetching}>
                {!health.isFetching && <RefreshCw aria-hidden />}
                Try again
              </Button>
            </div>
          )}

          {health.isSuccess && (
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">API</dt>
              <dd>
                <Badge tone={health.data.status === 'ok' ? 'success' : 'warning'}>
                  {health.data.status === 'ok' ? 'Running' : 'Degraded'}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">Database</dt>
              <dd>
                <Badge tone={health.data.checks.database === 'up' ? 'success' : 'danger'}>
                  {health.data.checks.database === 'up' ? 'Connected' : 'Not connected'}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">Version</dt>
              <dd className="tabular">{health.data.version}</dd>
              <dt className="text-muted-foreground">Checked on</dt>
              <dd className="tabular">{formatDate(new Date(health.data.time))}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      <a href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        Back to the app
      </a>
    </main>
  );
}
