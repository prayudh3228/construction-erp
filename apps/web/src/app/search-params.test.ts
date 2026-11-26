import { describe, expect, it } from 'vitest';
import { parseSearch, stringifySearch } from './search-params';

describe('URL search params', () => {
  it('keeps every value as the exact string in the URL', () => {
    // The router default would turn these into 1000, true, null and 123.
    expect(parseSearch('?project=1e3')).toEqual({ project: '1e3' });
    expect(parseSearch('?project=true')).toEqual({ project: 'true' });
    expect(parseSearch('?project=null')).toEqual({ project: 'null' });
    expect(parseSearch('project=123')).toEqual({ project: '123' });
  });

  it('decodes once and keeps the first of repeated keys', () => {
    expect(parseSearch('?redirect=%2Ffinance%3Fproject%3DPRJ-001&x=1&x=2')).toEqual({
      redirect: '/finance?project=PRJ-001',
      x: '1',
    });
    expect(parseSearch('')).toEqual({});
  });

  it('writes plain strings without quotes and leaves out empty values', () => {
    expect(stringifySearch({ project: '123' })).toBe('?project=123');
    expect(stringifySearch({ project: undefined, other: '' })).toBe('');
    expect(stringifySearch({ redirect: '/a?b=c' })).toBe('?redirect=%2Fa%3Fb%3Dc');
  });

  it('round-trips', () => {
    const s = { project: 'PRJ-001', redirect: '/hr?project=company' };
    expect(parseSearch(stringifySearch(s))).toEqual(s);
  });
});
