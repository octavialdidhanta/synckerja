import { describe, expect, it } from 'vitest';
import { normalizeTableNumber } from './normalizeTableNumber';

describe('normalizeTableNumber', () => {
  it('returns null when empty', () => {
    expect(normalizeTableNumber('')).toBeNull();
    expect(normalizeTableNumber('  ')).toBeNull();
    expect(normalizeTableNumber(null)).toBeNull();
  });

  it('trims and caps at 16 characters', () => {
    expect(normalizeTableNumber(' 4 ')).toBe('4');
    expect(normalizeTableNumber('B2')).toBe('B2');
    expect(normalizeTableNumber('12345678901234567890')).toBe('1234567890123456');
  });
});
