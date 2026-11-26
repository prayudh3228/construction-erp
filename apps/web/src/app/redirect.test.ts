import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
  it.each([
    ['/finance', '/finance'],
    ['/finance?project=PRJ-001', '/finance?project=PRJ-001'],
    ['/design-system#tables', '/design-system#tables'],
  ])('keeps same-site path %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    ['https://evil.example/'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    ['finance'],
    ['/\tevil'],
    ['/\n/evil.example'],
    ['/login'],
    ['/login?redirect=/x'],
    [''],
    [undefined],
    [42],
  ])('refuses %j and falls back to /', (input) => {
    expect(safeRedirectPath(input)).toBe('/');
  });

  it('uses the given fallback', () => {
    expect(safeRedirectPath('//x', '/hr')).toBe('/hr');
  });
});
