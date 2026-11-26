import {
  type FormatINROptions,
  type IsoDate,
  type Paise,
  formatDate,
  formatINR,
  toIsoDateInIndia,
} from '@erp/shared';
import { cn } from '@/lib/cn';

interface MoneyProps extends FormatINROptions {
  value: Paise;
  /** Show negative amounts in the danger colour (default false: many reports show credits). */
  colorNegative?: boolean;
  className?: string;
}

/** ₹ amount with lakh/crore grouping (₹12,34,567.89), in tabular figures so columns line up. */
export function Money({ value, colorNegative = false, className, ...options }: MoneyProps) {
  return (
    <span
      className={cn(
        'tabular whitespace-nowrap',
        colorNegative && value < 0n && 'text-danger',
        className,
      )}
    >
      {formatINR(value, options)}
    </span>
  );
}

/** Date as DD-MM-YYYY. A machine-readable ISO date goes in the `dateTime` attribute. */
export function IndianDate({ value, className }: { value: IsoDate | Date; className?: string }) {
  const display = formatDate(value);
  const iso = typeof value === 'string' ? value : toIsoDateInIndia(value);
  return (
    <time dateTime={iso} className={cn('tabular whitespace-nowrap', className)}>
      {display}
    </time>
  );
}
