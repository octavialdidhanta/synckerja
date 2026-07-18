import { describe, expect, it } from 'vitest';
import {
  applyContactCollectedEventsToMetrics,
  applyEnrollmentRowsToMetrics,
  defaultLast30DaysYmd,
  parseListMetricsDateRange,
  sumCampaignListMetricTotals,
  ymdRangeToInclusiveIsoBounds,
} from '../../../supabase/functions/_shared/leadMagnet/campaignListMetrics.ts';

describe('campaignListMetrics', () => {
  it('ymdRangeToInclusiveIsoBounds is inclusive UTC day', () => {
    expect(ymdRangeToInclusiveIsoBounds('2026-06-19', '2026-07-18')).toEqual({
      startIso: '2026-06-19T00:00:00.000Z',
      endIso: '2026-07-18T23:59:59.999Z',
    });
  });

  it('parseListMetricsDateRange falls back to last 30 days', () => {
    const now = new Date('2026-07-18T12:00:00.000Z');
    const parsed = parseListMetricsDateRange(null, null, now);
    const fallback = defaultLast30DaysYmd(now);
    expect(parsed.dateStart).toBe(fallback.dateStart);
    expect(parsed.dateEnd).toBe(fallback.dateEnd);
  });

  it('counts followers in range and keeps enrollments all-time', () => {
    const map = new Map();
    applyEnrollmentRowsToMetrics(
      map,
      [
        {
          campaign_id: 'c1',
          is_follower_at_start: false,
          became_follower_at: '2026-07-10T10:00:00.000Z',
        },
        {
          campaign_id: 'c1',
          is_follower_at_start: false,
          became_follower_at: '2026-05-01T10:00:00.000Z',
        },
        {
          campaign_id: 'c1',
          is_follower_at_start: true,
          became_follower_at: null,
        },
      ],
      ymdRangeToInclusiveIsoBounds('2026-07-01', '2026-07-18'),
    );
    const m = map.get('c1')!;
    expect(m.new_followers).toBe(1);
    expect(m.total_enrollments).toBe(3);
    expect(m.non_follower_at_start).toBe(2);
  });

  it('counts distinct email/phone and skips supplemental', () => {
    const map = new Map();
    applyContactCollectedEventsToMetrics(map, [
      {
        campaign_id: 'c1',
        enrollment_id: 'e1',
        created_at: '2026-07-10T10:00:00.000Z',
        metadata: { kind: 'email', supplemental: false },
      },
      {
        campaign_id: 'c1',
        enrollment_id: 'e1',
        created_at: '2026-07-11T10:00:00.000Z',
        metadata: { kind: 'email' },
      },
      {
        campaign_id: 'c1',
        enrollment_id: 'e2',
        created_at: '2026-07-12T10:00:00.000Z',
        metadata: { kind: 'email', supplemental: true },
      },
      {
        campaign_id: 'c1',
        enrollment_id: 'e3',
        created_at: '2026-07-13T10:00:00.000Z',
        metadata: { kind: 'phone' },
      },
      {
        campaign_id: 'c2',
        enrollment_id: 'e4',
        created_at: '2026-07-14T10:00:00.000Z',
        metadata: { kind: 'phone' },
      },
    ]);
    expect(map.get('c1')!.new_emails).toBe(1);
    expect(map.get('c1')!.new_phones).toBe(1);
    expect(map.get('c2')!.new_phones).toBe(1);
    expect(sumCampaignListMetricTotals(map)).toEqual({
      new_followers: 0,
      new_emails: 1,
      new_phones: 2,
    });
  });
});
