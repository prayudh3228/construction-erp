import { type IsoDate, type Paise, paise } from '@erp/shared';

/** FAKE sample rows for the design-system table. Vendor names are invented. */
export interface SampleBill {
  id: string;
  number: string;
  vendor: string;
  date: IsoDate;
  amount: Paise;
  status: 'draft' | 'approved' | 'paid';
}

const VENDORS = [
  'Acme Cement Traders',
  'Blue Hill Steel',
  'Cornerstone Aggregates',
  'Delta Electricals',
  'Evergreen Plumbing Supplies',
  'Fastline Hire Services',
];
const STATUSES: SampleBill['status'][] = ['draft', 'approved', 'paid'];

/** 37 deterministic rows: enough for four pages of 10, with lakh and crore amounts. */
export const SAMPLE_BILLS: readonly SampleBill[] = Array.from({ length: 37 }, (_, i) => {
  const n = i + 1;
  const day = ((n * 7) % 28) + 1;
  const month = ((n * 5) % 12) + 1;
  // Amounts from a few hundred rupees to over a crore, all exact paise.
  const amount = paise(BigInt((n * n * n * 977_731) % 1_500_000_000) + 12_345n);
  return {
    id: `BILL-${String(n).padStart(3, '0')}`,
    number: `INV/26-27/${String(1000 + n)}`,
    vendor: VENDORS[n % VENDORS.length]!,
    date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    amount,
    status: STATUSES[n % STATUSES.length]!,
  };
});
