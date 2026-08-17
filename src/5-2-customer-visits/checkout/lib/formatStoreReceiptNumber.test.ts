import { describe, expect, it } from 'vitest';
import {
  buildStoreReceiptText,
  formatStoreReceiptDateTime,
  formatStoreReceiptNumber,
} from './formatStoreReceiptNumber';

describe('formatStoreReceiptNumber', () => {
  it('uses the first 8 hex chars of the uuid', () => {
    expect(formatStoreReceiptNumber('a57c62c6-2a1a-4cfe-8d50-eeb68b76450e')).toBe('SC-A57C62C6');
  });

  it('returns empty when missing', () => {
    expect(formatStoreReceiptNumber(null)).toBe('');
    expect(formatStoreReceiptNumber('')).toBe('');
  });
});

describe('formatStoreReceiptDateTime', () => {
  it('formats sale created_at with date and time', () => {
    expect(
      formatStoreReceiptDateTime({
        saleCreatedAt: '2026-08-17T07:05:00.000Z',
      }),
    ).toMatch(/\d{2} \w{3} 2026 \d{2}:\d{2}/);
  });

  it('falls back to visit_date', () => {
    expect(
      formatStoreReceiptDateTime({
        visitDate: '2026-08-17',
      }),
    ).toBe('17 Aug 2026');
  });
});

describe('buildStoreReceiptText', () => {
  it('includes store, cash received, and change', () => {
    const text = buildStoreReceiptText({
      storeName: 'Kopi Senja',
      receiptNumber: 'SC-CBEAFFD0',
      datetime: '17 Aug 2026 14:05',
      clientName: '@hary.belajarai',
      ticketId: 'IG-EAB45F82',
      payMethod: 'Cash',
      tableNumber: '4',
      cashReceived: 'Rp 50.000',
      change: 'Rp 14.000',
      items: [{ name: 'Ayam Geprek · porsi', quantity: 2, unitPrice: 'Rp 18.000', lineTotal: 'Rp 36.000' }],
      total: 'Rp 36.000',
    });
    expect(text).toContain('Kopi Senja');
    expect(text).toContain('Meja 4');
    expect(text).toContain('SC-CBEAFFD0');
    expect(text).toContain('Cash received: Rp 50.000');
    expect(text).toContain('Change: Rp 14.000');
    expect(text).toContain('Total Rp 36.000');
  });
});
