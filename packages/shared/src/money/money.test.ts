import { describe, expect, it } from 'vitest';
import {
  abs,
  add,
  allocate,
  compare,
  formatINR,
  fromPaiseString,
  groupIndian,
  isNegative,
  isZero,
  multiply,
  negate,
  paise,
  percentage,
  roundTo,
  rupees,
  subtract,
  sum,
  toPaiseString,
  toRupeeString,
  ZERO,
} from './money.js';

describe('paise()', () => {
  it('accepts bigint and safe integers', () => {
    expect(paise(123n)).toBe(123n);
    expect(paise(-45)).toBe(-45n);
  });

  it('rejects fractional, unsafe or non-finite numbers', () => {
    expect(() => paise(1.5)).toThrow(/whole number of paise/);
    expect(() => paise(Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/);
    expect(() => paise(Number.NaN)).toThrow();
  });
});

describe('rupees()', () => {
  it('parses rupee strings exactly', () => {
    expect(rupees('0')).toBe(0n);
    expect(rupees('1')).toBe(100n);
    expect(rupees('1234.5')).toBe(123450n);
    expect(rupees('1234.56')).toBe(123456n);
    expect(rupees('-0.01')).toBe(-1n);
    // 0.1 + 0.2 style float traps do not exist here: 10 paise + 20 paise = 30 paise
    expect(add(rupees('0.1'), rupees('0.2'))).toBe(rupees('0.3'));
  });

  it('refuses more than 2 decimals unless a rounding mode is given', () => {
    expect(() => rupees('10.005')).toThrow(/more than 2 decimal/);
    // 10.005 rupees = 1000.5 paise -> half up = 1001
    expect(rupees('10.005', 'HALF_UP')).toBe(1001n);
    // half even: 1000.5 -> 1000 (even)
    expect(rupees('10.005', 'HALF_EVEN')).toBe(1000n);
    expect(rupees('10.009', 'DOWN')).toBe(1000n);
  });

  it('rejects malformed input', () => {
    for (const bad of ['', ' ', 'abc', '1,000', '1.', '.5', '1e3', '--1', '₹10']) {
      expect(() => rupees(bad), bad).toThrow(/Invalid decimal/);
    }
  });
});

describe('arithmetic', () => {
  it('adds, subtracts and sums', () => {
    expect(add(rupees('100'), rupees('0.50'))).toBe(10050n);
    expect(subtract(rupees('100'), rupees('150'))).toBe(-5000n);
    expect(sum([])).toBe(ZERO);
    expect(sum([rupees('1'), rupees('2'), rupees('3.33')])).toBe(633n);
  });

  it('negates, abs, compares and checks sign', () => {
    expect(negate(rupees('5'))).toBe(-500n);
    expect(abs(rupees('-5'))).toBe(500n);
    expect(compare(rupees('1'), rupees('2'))).toBe(-1);
    expect(compare(rupees('2'), rupees('2'))).toBe(0);
    expect(compare(rupees('3'), rupees('2'))).toBe(1);
    expect(isZero(ZERO)).toBe(true);
    expect(isNegative(rupees('-0.01'))).toBe(true);
    expect(isNegative(ZERO)).toBe(false);
  });
});

describe('multiply()', () => {
  it('multiplies by quantity or rate decimals, rounding once at the end', () => {
    // 12.5 bags x ₹385.40 = ₹4,817.50 exactly
    expect(multiply(rupees('385.40'), '12.5')).toBe(481750n);
    // 3.333 cum x ₹4,500.00 = ₹14,998.50 exactly
    expect(multiply(rupees('4500'), '3.333')).toBe(1499850n);
    // 0.333 x ₹1.00 = 33.3 paise -> 33
    expect(multiply(rupees('1'), '0.333')).toBe(33n);
    // 0.335 x ₹1.00 = 33.5 paise -> HALF_UP 34, DOWN 33; 0.345 -> 34.5 paise -> HALF_EVEN 34
    expect(multiply(rupees('1'), '0.335', 'HALF_UP')).toBe(34n);
    expect(multiply(rupees('1'), '0.345', 'HALF_EVEN')).toBe(34n);
    expect(multiply(rupees('1'), '0.335', 'DOWN')).toBe(33n);
  });

  it('rounds negative halves away from zero for HALF_UP', () => {
    // -0.335 x ₹1 = -33.5 paise -> -34
    expect(multiply(rupees('-1'), '0.335', 'HALF_UP')).toBe(-34n);
    expect(multiply(rupees('-1'), '0.335', 'FLOOR')).toBe(-34n);
    expect(multiply(rupees('-1'), '0.335', 'CEIL')).toBe(-33n);
  });

  it('accepts bigint factors', () => {
    expect(multiply(rupees('2.50'), 4n)).toBe(1000n);
  });
});

describe('percentage()', () => {
  it('computes GST-style percentages', () => {
    // 18% of ₹1,00,000 = ₹18,000
    expect(percentage(rupees('100000'), '18')).toBe(rupees('18000'));
    // 9% of ₹1,234.56 = ₹111.1104 -> ₹111.11
    expect(percentage(rupees('1234.56'), '9')).toBe(11111n);
    // 2.5% of ₹999.99 = ₹24.99975 -> ₹25.00 (HALF_UP)
    expect(percentage(rupees('999.99'), '2.5')).toBe(2500n);
    // 0.1% of ₹50,00,001 = ₹5,000.001 -> ₹5,000.00
    expect(percentage(rupees('5000001'), '0.1')).toBe(rupees('5000'));
  });
});

describe('roundTo()', () => {
  it('rounds to the nearest rupee', () => {
    expect(roundTo(rupees('100.49'), rupees('1'))).toBe(rupees('100'));
    expect(roundTo(rupees('100.50'), rupees('1'))).toBe(rupees('101'));
    expect(roundTo(rupees('-100.50'), rupees('1'))).toBe(rupees('-101'));
  });

  it('rounds to multiples of ₹10', () => {
    expect(roundTo(rupees('1234'), rupees('10'))).toBe(rupees('1230'));
    expect(roundTo(rupees('1235'), rupees('10'))).toBe(rupees('1240'));
    expect(roundTo(rupees('1231'), rupees('10'), 'UP')).toBe(rupees('1240'));
  });

  it('rejects a non-positive unit', () => {
    expect(() => roundTo(rupees('1'), ZERO)).toThrow(/positive/);
  });
});

describe('allocate()', () => {
  it('splits without losing or creating a paisa', () => {
    // ₹100 split 3 ways: 33.34 + 33.33 + 33.33
    const parts = allocate(rupees('100'), [1n, 1n, 1n]);
    expect(parts).toEqual([3334n, 3333n, 3333n]);
    expect(sum(parts)).toBe(rupees('100'));
  });

  it('splits by weights', () => {
    // ₹1,000 in ratio 70:30
    expect(allocate(rupees('1000'), [70n, 30n])).toEqual([70000n, 30000n]);
    // 10 paise in ratio 1:2 -> 3.33 + 6.67 -> 3 + 7 (largest remainder goes to index 1)
    expect(allocate(paise(10n), [1n, 2n])).toEqual([3n, 7n]);
  });

  it('splits negative amounts symmetrically', () => {
    expect(allocate(rupees('-100'), [1n, 1n, 1n])).toEqual([-3334n, -3333n, -3333n]);
  });

  it('rejects empty, negative or all-zero weights', () => {
    expect(() => allocate(rupees('1'), [])).toThrow();
    expect(() => allocate(rupees('1'), [0n, 0n])).toThrow();
    expect(() => allocate(rupees('1'), [1n, -1n])).toThrow();
  });
});

describe('formatting', () => {
  it('groups digits the Indian way (lakh/crore)', () => {
    expect(groupIndian('0')).toBe('0');
    expect(groupIndian('999')).toBe('999');
    expect(groupIndian('1000')).toBe('1,000');
    expect(groupIndian('100000')).toBe('1,00,000');
    expect(groupIndian('1234567')).toBe('12,34,567');
    expect(groupIndian('123456789')).toBe('12,34,56,789');
    expect(groupIndian('10000000000')).toBe('10,00,00,00,000');
  });

  it('formats ₹ amounts', () => {
    expect(formatINR(ZERO)).toBe('₹0.00');
    expect(formatINR(paise(5n))).toBe('₹0.05');
    expect(formatINR(rupees('1234567.89'))).toBe('₹12,34,567.89');
    expect(formatINR(rupees('-100000'))).toBe('-₹1,00,000.00');
    expect(formatINR(rupees('25000000'), { symbol: false })).toBe('2,50,00,000.00');
    expect(formatINR(rupees('1234.50'), { decimals: 0 })).toBe('₹1,235');
  });

  it('rounds negative amounts correctly when dropping paise', () => {
    // -₹1.50: HALF_UP -> -₹2, FLOOR (toward -infinity) -> -₹2, CEIL -> -₹1
    expect(formatINR(paise(-150), { decimals: 0 })).toBe('-₹2');
    expect(formatINR(paise(-150), { decimals: 0, mode: 'FLOOR' })).toBe('-₹2');
    expect(formatINR(paise(-150), { decimals: 0, mode: 'CEIL' })).toBe('-₹1');
    // -₹0.40 rounds to zero and must not show a minus sign
    expect(formatINR(paise(-40), { decimals: 0 })).toBe('₹0');
    expect(formatINR(paise(-40), { decimals: 0, symbol: false })).toBe('0');
  });

  it('converts to rupee strings and paise strings for transport', () => {
    expect(toRupeeString(rupees('1234.5'))).toBe('1234.50');
    expect(toRupeeString(paise(-7n))).toBe('-0.07');
    expect(toPaiseString(rupees('12.34'))).toBe('1234');
    expect(fromPaiseString('-1234')).toBe(-1234n);
    expect(() => fromPaiseString('12.5')).toThrow();
    expect(() => fromPaiseString('')).toThrow();
  });
});
