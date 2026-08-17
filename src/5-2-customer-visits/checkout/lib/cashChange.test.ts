import { describe, expect, it } from 'vitest';
import { changeDue, isTenderedEnough, parseTenderedAmount } from './cashChange';

describe('parseTenderedAmount', () => {
  it('returns null when empty', () => {
    expect(parseTenderedAmount('')).toBeNull();
    expect(parseTenderedAmount('  ')).toBeNull();
  });

  it('parses grouped digits', () => {
    expect(parseTenderedAmount('20.000')).toBe(20000);
  });
});

describe('isTenderedEnough', () => {
  it('allows empty tendered', () => {
    expect(isTenderedEnough(18000, null)).toBe(true);
  });

  it('requires tendered >= total when filled', () => {
    expect(isTenderedEnough(18000, 20000)).toBe(true);
    expect(isTenderedEnough(18000, 18000)).toBe(true);
    expect(isTenderedEnough(18000, 10000)).toBe(false);
  });
});

describe('changeDue', () => {
  it('returns null until tendered covers total', () => {
    expect(changeDue(18000, null)).toBeNull();
    expect(changeDue(18000, 10000)).toBeNull();
    expect(changeDue(18000, 20000)).toBe(2000);
    expect(changeDue(18000, 18000)).toBe(0);
  });
});
