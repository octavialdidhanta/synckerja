import { describe, expect, it } from 'vitest';
import { findTodaysMatchedVisit, type TodaysMatchedVisitWinner } from './findTodaysMatchedVisit';

function visit(partial: Partial<TodaysMatchedVisitWinner> & Pick<TodaysMatchedVisitWinner, 'id'>): TodaysMatchedVisitWinner {
  return {
    lead_id: 'ig-lead',
    visit_date: '2026-08-16',
    status: 'completed',
    match_status: 'matched',
    sales_activity_id: null,
    created_at: '2026-08-16T01:00:00.000Z',
    ...partial,
  };
}

describe('findTodaysMatchedVisit', () => {
  it('picks one winner when the same lead checked in twice today', () => {
    const winner = findTodaysMatchedVisit(
      [
        visit({ id: 'later', created_at: '2026-08-16T12:00:00.000Z' }),
        visit({ id: 'earlier', created_at: '2026-08-16T08:00:00.000Z' }),
      ],
      'ig-lead',
      '2026-08-16',
    );
    expect(winner?.id).toBe('earlier');
  });

  it('prefers the visit that already has a sale', () => {
    const winner = findTodaysMatchedVisit(
      [
        visit({ id: 'first', created_at: '2026-08-16T08:00:00.000Z' }),
        visit({
          id: 'paid',
          created_at: '2026-08-16T12:00:00.000Z',
          sales_activity_id: 'sale-1',
        }),
      ],
      'ig-lead',
      '2026-08-16',
    );
    expect(winner?.id).toBe('paid');
  });

  it('does not reuse a different lead (WA vs IG)', () => {
    const winner = findTodaysMatchedVisit(
      [
        visit({ id: 'ig', lead_id: 'ig-lead' }),
        visit({ id: 'wa', lead_id: 'wa-lead' }),
      ],
      'ig-lead',
      '2026-08-16',
    );
    expect(winner?.id).toBe('ig');
  });

  it('does not reuse yesterday', () => {
    expect(
      findTodaysMatchedVisit(
        [visit({ id: 'yesterday', visit_date: '2026-08-15' })],
        'ig-lead',
        '2026-08-16',
      ),
    ).toBeNull();
  });

  it('ignores cancelled and unmatched rows', () => {
    expect(
      findTodaysMatchedVisit(
        [
          visit({ id: 'cancelled', status: 'cancelled' }),
          visit({ id: 'unmatched', match_status: 'unmatched', lead_id: null }),
        ],
        'ig-lead',
        '2026-08-16',
      ),
    ).toBeNull();
  });
});
