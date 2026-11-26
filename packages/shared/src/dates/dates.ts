/**
 * Calendar dates are carried as ISO strings "YYYY-MM-DD" (no time, no zone).
 * Instants (Date objects) are converted using India Standard Time.
 * Display format is DD-MM-YYYY. The financial year runs 1 April to 31 March.
 */

export type IsoDate = string;

export const INDIA_TIME_ZONE = 'Asia/Kolkata';

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export function isValidIsoDate(value: string): boolean {
  const m = ISO_PATTERN.exec(value);
  if (!m) return false;
  return isRealDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

const indiaDateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: INDIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date in India for an instant. */
export function toIsoDateInIndia(instant: Date): IsoDate {
  if (Number.isNaN(instant.getTime())) throw new RangeError('Invalid date');
  const parts = Object.fromEntries(
    indiaDateParts.formatToParts(instant).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Format a calendar date or an instant as DD-MM-YYYY. */
export function formatDate(value: IsoDate | Date): string {
  const iso = value instanceof Date ? toIsoDateInIndia(value) : value;
  if (!isValidIsoDate(iso)) throw new RangeError(`Invalid date: "${String(value)}"`);
  const [year, month, day] = iso.split('-');
  return `${day}-${month}-${year}`;
}

/** Parse DD-MM-YYYY into an ISO calendar date. */
export function parseDisplayDate(value: string): IsoDate {
  const m = DISPLAY_PATTERN.exec(value);
  if (!m) throw new SyntaxError(`Date must be DD-MM-YYYY: "${value}"`);
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  if (!isValidIsoDate(iso)) throw new RangeError(`Invalid date: "${value}"`);
  return iso;
}

export interface FinancialYear {
  /** e.g. "2026-27" */
  label: string;
  startDate: IsoDate;
  endDate: IsoDate;
  startYear: number;
}

/** The Indian financial year (April to March) containing a calendar date. */
export function financialYearOf(date: IsoDate): FinancialYear {
  if (!isValidIsoDate(date)) throw new RangeError(`Invalid date: "${date}"`);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    label: `${startYear}-${String(endYear % 100).padStart(2, '0')}`,
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
    startYear,
  };
}
