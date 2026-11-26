/**
 * Money is always held as a whole number of paise in a bigint. Never use floating point.
 * Rounding happens once, at the end of a calculation, with an explicit mode (see rounding.ts).
 */
import { DEFAULT_ROUNDING, divRound, parseDecimal, type RoundingMode } from './rounding.js';

declare const paiseBrand: unique symbol;
/** An amount in paise (1 rupee = 100 paise). */
export type Paise = bigint & { readonly [paiseBrand]: true };

export const PAISE_PER_RUPEE = 100n;
export const ZERO = 0n as Paise;

/** Wrap a whole number of paise. Numbers must be safe integers. */
export function paise(value: bigint | number): Paise {
  if (typeof value === 'bigint') return value as Paise;
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new RangeError(`Amount must be a whole number of paise, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Amount must be a safe integer number of paise, got ${value}`);
  }
  return BigInt(value) as Paise;
}

/**
 * Parse a rupee amount written as a decimal string, e.g. "1234.56".
 * More than 2 decimal places is an error unless a rounding mode is supplied.
 */
export function rupees(value: string, mode?: RoundingMode): Paise {
  const { units, scale, decimals } = parseDecimal(value);
  const scaled = units * PAISE_PER_RUPEE;
  if (decimals > 2 && mode === undefined) {
    throw new RangeError(`Rupee amount "${value}" has more than 2 decimal places`);
  }
  return divRound(scaled, scale, mode ?? DEFAULT_ROUNDING) as Paise;
}

export function add(...values: Paise[]): Paise {
  return sum(values);
}

export function sum(values: readonly Paise[]): Paise {
  let total = 0n;
  for (const v of values) total += v;
  return total as Paise;
}

export function subtract(a: Paise, b: Paise): Paise {
  return (a - b) as Paise;
}

export function negate(a: Paise): Paise {
  return -a as Paise;
}

export function abs(a: Paise): Paise {
  return (a < 0n ? -a : a) as Paise;
}

export function compare(a: Paise, b: Paise): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isZero(a: Paise): boolean {
  return a === 0n;
}

export function isNegative(a: Paise): boolean {
  return a < 0n;
}

/** Multiply an amount by an exact decimal factor (a quantity or a rate), rounding once. */
export function multiply(
  amount: Paise,
  factor: string | bigint,
  mode: RoundingMode = DEFAULT_ROUNDING,
): Paise {
  if (typeof factor === 'bigint') return (amount * factor) as Paise;
  const { units, scale } = parseDecimal(factor);
  return divRound(amount * units, scale, mode) as Paise;
}

/** `percent`% of an amount, e.g. percentage(x, '18') for 18%. */
export function percentage(
  amount: Paise,
  percent: string,
  mode: RoundingMode = DEFAULT_ROUNDING,
): Paise {
  const { units, scale } = parseDecimal(percent);
  return divRound(amount * units, scale * 100n, mode) as Paise;
}

/** Round to a multiple of `unit` paise, e.g. roundTo(x, rupees('1')) for the nearest rupee. */
export function roundTo(amount: Paise, unit: Paise, mode: RoundingMode = DEFAULT_ROUNDING): Paise {
  if (unit <= 0n) throw new RangeError('Rounding unit must be positive');
  return (divRound(amount, unit, mode) * unit) as Paise;
}

/**
 * Split an amount by integer weights so the parts always add back to the amount.
 * Leftover paise go to the parts with the largest remainders (ties: earliest first).
 */
export function allocate(amount: Paise, weights: readonly bigint[]): Paise[] {
  if (weights.length === 0) throw new RangeError('At least one weight is required');
  if (weights.some((w) => w < 0n)) throw new RangeError('Weights must not be negative');
  const total = weights.reduce((a, w) => a + w, 0n);
  if (total === 0n) throw new RangeError('Weights must not all be zero');

  if (amount < 0n) return allocate(-amount as Paise, weights).map((p) => -p as Paise);

  const parts = weights.map((w) => (amount * w) / total);
  const remainders = weights.map((w, i) => ({ i, r: (amount * w) % total }));
  let leftover = amount - parts.reduce((a, p) => a + p, 0n);
  remainders.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (const { i } of remainders) {
    if (leftover === 0n) break;
    parts[i] = (parts[i] ?? 0n) + 1n;
    leftover -= 1n;
  }
  return parts as Paise[];
}

/** Group an unsigned digit string in the Indian system: 12,34,56,789. */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`;
}

export interface FormatINROptions {
  /** Show the ₹ symbol (default true). */
  symbol?: boolean;
  /** 2 (default) shows paise; 0 rounds to whole rupees. */
  decimals?: 0 | 2;
  mode?: RoundingMode;
}

/** Format as Indian rupees, e.g. ₹12,34,567.89 or -₹1,00,000.00. */
export function formatINR(amount: Paise, options: FormatINROptions = {}): string {
  const { symbol = true, decimals = 2, mode = DEFAULT_ROUNDING } = options;
  const negative = amount < 0n;
  const magnitude = negative ? -amount : amount;
  const prefix = `${negative ? '-' : ''}${symbol ? '₹' : ''}`;
  if (decimals === 0) {
    return `${prefix}${groupIndian(divRound(magnitude, PAISE_PER_RUPEE, mode).toString())}`;
  }
  const whole = magnitude / PAISE_PER_RUPEE;
  const fraction = (magnitude % PAISE_PER_RUPEE).toString().padStart(2, '0');
  return `${prefix}${groupIndian(whole.toString())}.${fraction}`;
}

/** Plain rupee string with 2 decimals and no grouping, e.g. "-1234.50" (exports, Tally). */
export function toRupeeString(amount: Paise): string {
  const negative = amount < 0n;
  const magnitude = negative ? -amount : amount;
  const whole = magnitude / PAISE_PER_RUPEE;
  const fraction = (magnitude % PAISE_PER_RUPEE).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Paise as an integer string, the wire format for money in the API (JSON has no bigint). */
export function toPaiseString(amount: Paise): string {
  return amount.toString();
}

export function fromPaiseString(value: string): Paise {
  if (!/^-?\d+$/.test(value)) throw new SyntaxError(`Invalid paise string: "${value}"`);
  return BigInt(value) as Paise;
}
