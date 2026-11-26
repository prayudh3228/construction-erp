import { describe, expect, it } from 'vitest';
import {
  financialYearOf,
  formatDate,
  isValidIsoDate,
  parseDisplayDate,
  toIsoDateInIndia,
} from './dates.js';

describe('isValidIsoDate()', () => {
  it('accepts real calendar dates only', () => {
    expect(isValidIsoDate('2026-04-01')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true); // leap year
    expect(isValidIsoDate('2027-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-4-1')).toBe(false);
    expect(isValidIsoDate('01-04-2026')).toBe(false);
    expect(isValidIsoDate('1899-12-31')).toBe(false);
    expect(isValidIsoDate('0099-01-01')).toBe(false);
  });
});

describe('formatDate()', () => {
  it('formats calendar dates as DD-MM-YYYY', () => {
    expect(formatDate('2026-04-01')).toBe('01-04-2026');
    expect(formatDate('1999-12-31')).toBe('31-12-1999');
  });

  it('formats instants in India time (IST, UTC+5:30)', () => {
    // 31-03-2026 20:00 UTC is already 01-04-2026 01:30 IST
    expect(formatDate(new Date('2026-03-31T20:00:00Z'))).toBe('01-04-2026');
    expect(toIsoDateInIndia(new Date('2026-03-31T18:29:59Z'))).toBe('2026-03-31');
    expect(toIsoDateInIndia(new Date('2026-03-31T18:30:00Z'))).toBe('2026-04-01');
  });

  it('rejects invalid input', () => {
    expect(() => formatDate('2026-02-30')).toThrow(/Invalid date/);
    expect(() => formatDate(new Date('nope'))).toThrow(/Invalid date/);
  });
});

describe('parseDisplayDate()', () => {
  it('parses DD-MM-YYYY to an ISO calendar date', () => {
    expect(parseDisplayDate('01-04-2026')).toBe('2026-04-01');
  });

  it('rejects impossible or wrongly shaped dates', () => {
    expect(() => parseDisplayDate('31-04-2026')).toThrow();
    expect(() => parseDisplayDate('2026-04-01')).toThrow();
    expect(() => parseDisplayDate('1-4-2026')).toThrow();
  });
});

describe('financialYearOf()', () => {
  it('runs April to March', () => {
    expect(financialYearOf('2026-04-01')).toEqual({
      label: '2026-27',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      startYear: 2026,
    });
    expect(financialYearOf('2026-03-31').label).toBe('2025-26');
    expect(financialYearOf('2027-01-15').label).toBe('2026-27');
    expect(financialYearOf('1999-06-01').label).toBe('1999-00');
    expect(() => financialYearOf('0999-01-01')).toThrow(/Invalid date/);
  });
});
