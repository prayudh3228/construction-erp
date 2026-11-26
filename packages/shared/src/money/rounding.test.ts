import { describe, expect, it } from 'vitest';
import { divRound, parseDecimal, type RoundingMode } from './rounding.js';

// Each row: numerator / 10, expected result per mode. Covers below half, exactly half, above half.
const cases: Array<[bigint, Record<RoundingMode, bigint>]> = [
  [24n, { HALF_UP: 2n, HALF_EVEN: 2n, DOWN: 2n, UP: 3n, FLOOR: 2n, CEIL: 3n }], // 2.4
  [25n, { HALF_UP: 3n, HALF_EVEN: 2n, DOWN: 2n, UP: 3n, FLOOR: 2n, CEIL: 3n }], // 2.5
  [35n, { HALF_UP: 4n, HALF_EVEN: 4n, DOWN: 3n, UP: 4n, FLOOR: 3n, CEIL: 4n }], // 3.5
  [26n, { HALF_UP: 3n, HALF_EVEN: 3n, DOWN: 2n, UP: 3n, FLOOR: 2n, CEIL: 3n }], // 2.6
  [-25n, { HALF_UP: -3n, HALF_EVEN: -2n, DOWN: -2n, UP: -3n, FLOOR: -3n, CEIL: -2n }], // -2.5
  [-24n, { HALF_UP: -2n, HALF_EVEN: -2n, DOWN: -2n, UP: -3n, FLOOR: -3n, CEIL: -2n }], // -2.4
  [20n, { HALF_UP: 2n, HALF_EVEN: 2n, DOWN: 2n, UP: 2n, FLOOR: 2n, CEIL: 2n }], // exact
  [0n, { HALF_UP: 0n, HALF_EVEN: 0n, DOWN: 0n, UP: 0n, FLOOR: 0n, CEIL: 0n }],
];

describe('divRound()', () => {
  for (const [n, expected] of cases) {
    for (const [mode, result] of Object.entries(expected) as Array<[RoundingMode, bigint]>) {
      it(`${n}/10 with ${mode} = ${result}`, () => {
        expect(divRound(n, 10n, mode)).toBe(result);
      });
    }
  }

  it('rejects zero or negative divisors', () => {
    expect(() => divRound(1n, 0n)).toThrow();
    expect(() => divRound(1n, -1n)).toThrow();
  });
});

describe('parseDecimal()', () => {
  it('parses exactly', () => {
    expect(parseDecimal('12.345')).toEqual({ units: 12345n, scale: 1000n, decimals: 3 });
    expect(parseDecimal('-0.5')).toEqual({ units: -5n, scale: 10n, decimals: 1 });
    expect(parseDecimal('7')).toEqual({ units: 7n, scale: 1n, decimals: 0 });
  });
});
