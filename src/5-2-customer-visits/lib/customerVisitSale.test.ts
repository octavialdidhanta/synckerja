import { describe, expect, it } from 'vitest';
import type { CustomerVisitRow } from './customerVisit.types';
import {
  canStartStoreCheckout,
  canViewVisitReceipt,
  customerVisitSale,
  isVisitPaid,
  matchesVisitSaleFilter,
  todayCashSummary,
  todayPaidSummary,
  visitSaleAmount,
} from './customerVisitSale';

function visit(partial: Partial<CustomerVisitRow> = {}): CustomerVisitRow {
  return {
    id: 'v1',
    organization_id: 'org',
    visit_date: '2026-08-17',
    status: 'completed',
    lead_id: 'lead-1',
    lookup_kind: 'phone',
    lookup_raw: '0812',
    lookup_normalized: '62812',
    match_status: 'matched',
    notes: null,
    sales_activity_id: null,
    created_at: '2026-08-17T07:00:00.000Z',
    ...partial,
  };
}

describe('customerVisitSale', () => {
  it('treats sales_activity_id as paid', () => {
    expect(isVisitPaid(visit())).toBe(false);
    expect(isVisitPaid(visit({ sales_activity_id: 'sale-1' }))).toBe(true);
    expect(canViewVisitReceipt(visit({ sales_activity_id: 'sale-1' }))).toBe(true);
  });

  it('starts checkout for today’s matched visits even after pay', () => {
    const today = '2026-08-17';
    expect(canStartStoreCheckout(visit(), today)).toBe(true);
    expect(canStartStoreCheckout(visit({ sales_activity_id: 'sale-1' }), today)).toBe(true);
    expect(canStartStoreCheckout(visit({ visit_date: '2026-08-16' }), today)).toBe(false);
    expect(canStartStoreCheckout(visit({ match_status: 'unmatched', lead_id: null }), today)).toBe(false);
  });

  it('filters paid vs unpaid', () => {
    const unpaid = visit({ id: 'u' });
    const paid = visit({ id: 'p', sales_activity_id: 'sale-1' });
    expect(matchesVisitSaleFilter(unpaid, 'all')).toBe(true);
    expect(matchesVisitSaleFilter(paid, 'paid')).toBe(true);
    expect(matchesVisitSaleFilter(unpaid, 'paid')).toBe(false);
    expect(matchesVisitSaleFilter(unpaid, 'unpaid')).toBe(true);
    expect(matchesVisitSaleFilter(paid, 'unpaid')).toBe(false);
  });

  it('reads sale embed from object or array', () => {
    expect(
      customerVisitSale(
        visit({
          sales_activities: {
            id: 'sale-1',
            total_amount: 25000,
            payment_method: 'cash',
            payment_reference: null,
            cash_tendered: 50000,
            created_at: '2026-08-17T07:00:00.000Z',
          },
        }),
      )?.total_amount,
    ).toBe(25000);
    expect(
      customerVisitSale(
        visit({
          sales_activities: [{ id: 'sale-2', total_amount: 1000, payment_method: 'e_wallet', payment_reference: 'QRIS-9' }],
        }),
      )?.id,
    ).toBe('sale-2');
    expect(
      customerVisitSale(
        visit({
          sales_activities: [{ id: 'sale-2', total_amount: 1000, payment_method: 'e_wallet', payment_reference: 'QRIS-9' }],
        }),
      )?.payment_reference,
    ).toBe('QRIS-9');
    expect(
      customerVisitSale(
        visit({
          sales_activities: {
            id: 'sale-1',
            total_amount: 25000,
            payment_method: 'cash',
            cash_tendered: 50000,
            created_at: '2026-08-17T07:00:00.000Z',
          },
        }),
      )?.cash_tendered,
    ).toBe(50000);
    expect(
      customerVisitSale(
        visit({
          sales_activities: {
            id: 'sale-1',
            total_amount: 25000,
            payment_method: 'cash',
            cash_tendered: 50000,
            created_at: '2026-08-17T07:00:00.000Z',
          },
        }),
      )?.created_at,
    ).toBe('2026-08-17T07:00:00.000Z');
  });

  it('summarizes today’s paid tickets, not visits', () => {
    const summary = todayPaidSummary(
      [
        visit({
          sales_activity_id: 'a2',
          sales_activities: { id: 'a2', total_amount: 14000, payment_method: 'cash' },
          store_tickets: [
            { id: 'a1', total_amount: 10000, payment_method: 'cash' },
            { id: 'a2', total_amount: 14000, payment_method: 'cash' },
          ],
        }),
        visit({
          id: 'v2',
          visit_date: '2026-08-16',
          sales_activity_id: 'b',
          sales_activities: { id: 'b', total_amount: 999, payment_method: 'cash' },
        }),
        visit({ id: 'v3' }),
      ],
      '2026-08-17',
    );
    expect(summary).toEqual({ count: 2, total: 24000 });
    expect(
      visitSaleAmount(
        visit({
          sales_activity_id: 'a2',
          store_tickets: [
            { id: 'a1', total_amount: 10000, payment_method: 'cash' },
            { id: 'a2', total_amount: 14000, payment_method: 'cash' },
          ],
        }),
      ),
    ).toBe(24000);
  });

  it('summarizes today’s cash tickets only, using ticket totals not tendered', () => {
    expect(
      todayCashSummary(
        [
          visit({
            sales_activity_id: 'a2',
            store_tickets: [
              {
                id: 'a1',
                total_amount: 36000,
                payment_method: 'cash',
                cash_tendered: 50000,
                date: '2026-08-17',
              },
              {
                id: 'a2',
                total_amount: 14000,
                payment_method: 'bank_transfer',
                date: '2026-08-17',
              },
              {
                id: 'a3',
                total_amount: 20000,
                payment_method: 'cash',
                date: '2026-08-17',
              },
            ],
          }),
          visit({
            id: 'v2',
            visit_date: '2026-08-16',
            sales_activity_id: 'b',
            store_tickets: [{ id: 'b', total_amount: 999, payment_method: 'cash', date: '2026-08-16' }],
          }),
          visit({
            id: 'v3',
            sales_activity_id: 'c',
            sales_activities: { id: 'c', total_amount: 5000, payment_method: 'e_wallet' },
          }),
        ],
        '2026-08-17',
      ),
    ).toEqual({ count: 2, total: 56000 });
  });
});
