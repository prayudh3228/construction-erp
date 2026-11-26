import { type Paise, formatDate, paise, rupees } from '@erp/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePageTitle } from '@/app/page-title';
import { DataTable } from '@/components/data-table/data-table';
import { IndianDate, Money } from '@/components/format';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import { SAMPLE_BILLS, type SampleBill } from '@/demo/sample-bills';

const BILL_TONE: Record<SampleBill['status'], BadgeTone> = {
  draft: 'neutral',
  approved: 'info',
  paid: 'success',
};
const BILL_LABEL: Record<SampleBill['status'], string> = {
  draft: 'Draft',
  approved: 'Approved',
  paid: 'Paid',
};

type TableMode = 'data' | 'loading' | 'empty' | 'error';

const MONEY_SAMPLES: [string, Paise][] = [
  ['Small', rupees('950.5')],
  ['Lakh', rupees('123456.78')],
  ['Crore', rupees('12345678.9')],
  ['Negative', rupees('-250000')],
  ['Zero', paise(0)],
];

/** Living reference for the design system (demo mode only). */
export function DesignSystemPage() {
  usePageTitle('Design system');
  const [mode, setMode] = useState<TableMode>('data');
  const [qty, setQty] = useState('');
  const qtyError = qty !== '' && !/^\d+(\.\d{1,3})?$/.test(qty) ? 'Enter a number.' : undefined;

  const columns = useMemo<ColumnDef<SampleBill, unknown>[]>(
    () => [
      { accessorKey: 'number', header: 'Bill no.', enableHiding: false },
      { accessorKey: 'vendor', header: 'Vendor' },
      {
        accessorKey: 'date',
        header: 'Date',
        meta: { searchText: (b) => formatDate(b.date) },
        cell: ({ row }) => <IndianDate value={row.original.date} />,
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        meta: { align: 'right' },
        // bigint sorts exactly; never convert money to a float to compare it.
        sortingFn: (a, b) => {
          const x = a.original.amount;
          const y = b.original.amount;
          return x < y ? -1 : x > y ? 1 : 0;
        },
        enableGlobalFilter: false,
        cell: ({ row }) => <Money value={row.original.amount} />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        filterFn: 'equalsString',
        meta: {
          filterAllLabel: 'All statuses',
          searchText: (b) => BILL_LABEL[b.status],
          filterOptions: Object.entries(BILL_LABEL).map(([value, label]) => ({ value, label })),
        },
        cell: ({ row }) => (
          <Badge tone={BILL_TONE[row.original.status]}>{BILL_LABEL[row.original.status]}</Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Design system"
        description="Every shared component, in each of its states. All data is fake."
        eyebrow="Demo only"
      />

      <Card>
        <CardHeader>
          <CardTitle>Buttons and badges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>
              <Plus aria-hidden />
              Primary
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete</Button>
            <Button variant="link">Link</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['neutral', 'brand', 'success', 'warning', 'danger', 'info'] as const).map((t) => (
              <Badge key={t} tone={t}>
                {t}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form fields</CardTitle>
          <CardDescription>Errors show inline, under the field, as you leave it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Vendor name" hint="As printed on the invoice." required>
            <Input placeholder="e.g. Acme Cement Traders" />
          </FormField>
          <FormField label="Quantity" error={qtyError} hint="Up to 3 decimals.">
            <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </FormField>
          <FormField label="Unit">
            <NativeSelect defaultValue="bag">
              <option value="bag">Bag</option>
              <option value="cum">Cubic metre</option>
              <option value="mt">Tonne</option>
            </NativeSelect>
          </FormField>
          <div className="flex items-center gap-2 self-end pb-2">
            <Checkbox id="ds-gst" defaultChecked />
            <Label htmlFor="ds-gst">GST applicable</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indian formats</CardTitle>
          <CardDescription>₹ with lakh and crore grouping; dates as DD-MM-YYYY.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {MONEY_SAMPLES.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>
                  <Money value={value} colorNegative />
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Financial year start</dt>
              <dd>
                <IndianDate value="2026-04-01" />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data table</CardTitle>
          <CardDescription>
            Search, filter, sort, paginate and choose columns. Switch the state to see how each
            looks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Table state</legend>
            {(['data', 'loading', 'empty', 'error'] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? 'primary' : 'outline'}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {m[0]!.toUpperCase() + m.slice(1)}
              </Button>
            ))}
          </fieldset>
          <DataTable
            label="Sample bills"
            columns={columns}
            data={mode === 'empty' ? [] : SAMPLE_BILLS}
            getRowId={(b) => b.id}
            isLoading={mode === 'loading'}
            error={mode === 'error' ? new Error('demo') : undefined}
            onRetry={() => setMode('data')}
            searchPlaceholder="Search bills…"
            initialSorting={[{ id: 'date', desc: true }]}
            empty={{
              title: 'No bills yet',
              description: 'Bills you enter or scan will appear here.',
              action: <Button>Add a bill</Button>,
            }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <EmptyState title="Empty state" description="Says why it is empty and what to do next." />
        <ErrorState
          title="Error state"
          description="Explains and offers a retry."
          onRetry={() => toast('Retrying…')}
        />
        <Card>
          <CardContent>
            <LoadingState label="Loading sample…" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dialog and toast</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Approve this bill?</DialogTitle>
              <DialogDescription>
                It moves to the payment queue. You can still reject it before payment.
              </DialogDescription>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button onClick={() => toast.success('Bill approved (demo).')}>Approve</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => toast.success('Saved.')}>
            Show success toast
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
