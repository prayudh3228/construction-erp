/**
 * Rounding modes used across all money and quantity calculations.
 *
 * - HALF_UP: round half away from zero (commercial rounding, the default).
 * - HALF_EVEN: round half to the nearest even digit (banker's rounding).
 * - DOWN: toward zero (truncate).
 * - UP: away from zero.
 * - FLOOR: toward negative infinity.
 * - CEIL: toward positive infinity.
 */
export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP' | 'FLOOR' | 'CEIL';

export const DEFAULT_ROUNDING: RoundingMode = 'HALF_UP';

/** Integer division of n by d (d must be positive) with an explicit rounding mode. */
export function divRound(n: bigint, d: bigint, mode: RoundingMode = DEFAULT_ROUNDING): bigint {
  if (d <= 0n) throw new RangeError('Divisor must be positive');
  const q = n / d; // truncates toward zero
  const r = n % d; // same sign as n
  if (r === 0n) return q;

  const negative = n < 0n;
  const awayFromZero = negative ? q - 1n : q + 1n;
  const twiceRemainder = (r < 0n ? -r : r) * 2n;

  switch (mode) {
    case 'DOWN':
      return q;
    case 'UP':
      return awayFromZero;
    case 'FLOOR':
      return negative ? awayFromZero : q;
    case 'CEIL':
      return negative ? q : awayFromZero;
    case 'HALF_UP':
      return twiceRemainder >= d ? awayFromZero : q;
    case 'HALF_EVEN':
      if (twiceRemainder > d) return awayFromZero;
      if (twiceRemainder < d) return q;
      return q % 2n === 0n ? q : awayFromZero;
  }
}

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/** A decimal string parsed into an exact integer numerator over a power-of-ten scale. */
export interface ParsedDecimal {
  units: bigint;
  scale: bigint;
  decimals: number;
}

/** Parse a plain decimal string such as "-12.345" exactly. No commas, exponents or symbols. */
export function parseDecimal(value: string): ParsedDecimal {
  if (!DECIMAL_PATTERN.test(value)) throw new SyntaxError(`Invalid decimal: "${value}"`);
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const decimals = fraction.length;
  const scale = 10n ** BigInt(decimals);
  const magnitude = BigInt(whole) * scale + (fraction ? BigInt(fraction) : 0n);
  return { units: negative ? -magnitude : magnitude, scale, decimals };
}
