import { describe, expect, it } from 'vitest';
import {
  applyContactCollectedEventsToMetrics,
  applyEnrollmentRowsToMetrics,
  applyOfflineVisitRowsToMetrics,
  applyPaidSalesActivitiesToMetrics,
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
          lead_id: 'l1',
          created_at: '2026-07-10T10:00:00.000Z',
        },
        {
          campaign_id: 'c1',
          is_follower_at_start: false,
          became_follower_at: '2026-05-01T10:00:00.000Z',
          lead_id: 'l2',
          created_at: '2026-05-01T10:00:00.000Z',
        },
        {
          campaign_id: 'c1',
          is_follower_at_start: true,
          became_follower_at: null,
          lead_id: null,
          created_at: '2026-07-12T10:00:00.000Z',
        },
      ],
      ymdRangeToInclusiveIsoBounds('2026-07-01', '2026-07-18'),
    );
    const m = map.get('c1')!;
    expect(m.new_followers).toBe(1);
    expect(m.new_leads).toBe(1);
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
      new_leads: 0,
      offline_visits: 0,
      new_followers: 0,
      new_emails: 1,
      new_phones: 2,
      transactions: 0,
      revenue: 0,
      aov: 0,
    });
  });

  it('counts unique leads in range and skips null or out-of-range', () => {
    const map = new Map();
    applyEnrollmentRowsToMetrics(
      map,
      [
        {
          campaign_id: 'c1',
          is_follower_at_start: null,
          became_follower_at: null,
          lead_id: 'l-same',
          created_at: '2026-07-10T10:00:00.000Z',
        },
        {
          campaign_id: 'c1',
          is_follower_at_start: null,
          became_follower_at: null,
          lead_id: 'l-same',
          created_at: '2026-07-11T10:00:00.000Z',
        },
        {
          campaign_id: 'c1',
          is_follower_at_start: null,
          became_follower_at: null,
          lead_id: null,
          created_at: '2026-07-12T10:00:00.000Z',
        },
        {
          campaign_id: 'c1',
          is_follower_at_start: null,
          became_follower_at: null,
          lead_id: 'l-old',
          created_at: '2026-05-01T10:00:00.000Z',
        },
        {
          campaign_id: 'c2',
          is_follower_at_start: null,
          became_follower_at: null,
          lead_id: 'l-other',
          created_at: '2026-07-14T10:00:00.000Z',
        },
      ],
      ymdRangeToInclusiveIsoBounds('2026-07-01', '2026-07-18'),
    );
    expect(map.get('c1')!.new_leads).toBe(1);
    expect(map.get('c2')!.new_leads).toBe(1);
    expect(sumCampaignListMetricTotals(map)).toEqual({
      new_leads: 2,
      offline_visits: 0,
      new_followers: 0,
      new_emails: 0,
      new_phones: 0,
      transactions: 0,
      revenue: 0,
      aov: 0,
    });
  });

  it('counts unique completed offline visits per campaign and dual-enrolls 1+1', () => {
    const map = new Map();
    const enrollments = [
      {
        campaign_id: 'test',
        is_follower_at_start: null,
        became_follower_at: null,
        lead_id: 'person-a',
        created_at: '2026-05-01T10:00:00.000Z',
      },
      {
        campaign_id: 'juli',
        is_follower_at_start: null,
        became_follower_at: null,
        lead_id: 'person-a',
        created_at: '2026-06-01T10:00:00.000Z',
      },
      {
        campaign_id: 'test',
        is_follower_at_start: null,
        became_follower_at: null,
        lead_id: 'person-b',
        created_at: '2026-07-01T10:00:00.000Z',
      },
    ];
    applyOfflineVisitRowsToMetrics(
      map,
      [
        { lead_id: 'person-a', visit_date: '2026-07-10', status: 'completed' },
        { lead_id: 'person-a', visit_date: '2026-07-12', status: 'completed' },
        { lead_id: 'person-b', visit_date: '2026-07-11', status: 'scheduled' },
        { lead_id: 'person-b', visit_date: '2026-05-02', status: 'completed' },
        { lead_id: null, visit_date: '2026-07-10', status: 'completed' },
      ],
      enrollments,
      { dateStart: '2026-07-01', dateEnd: '2026-07-18' },
    );
    expect(map.get('test')!.offline_visits).toBe(1);
    expect(map.get('juli')!.offline_visits).toBe(1);
    expect(sumCampaignListMetricTotals(map)).toEqual({
      new_leads: 0,
      offline_visits: 2,
      new_followers: 0,
      new_emails: 0,
      new_phones: 0,
      transactions: 0,
      revenue: 0,
      aov: 0,
    });
  });

  it('counts matched customer visits and skips unmatched (null lead_id)', () => {
    const map = new Map();
    const enrollments = [
      {
        campaign_id: 'test',
        is_follower_at_start: null,
        became_follower_at: null,
        lead_id: 'walk-in',
        created_at: '2026-06-01T10:00:00.000Z',
      },
    ];
    applyOfflineVisitRowsToMetrics(
      map,
      [
        { lead_id: 'walk-in', visit_date: '2026-07-10', status: 'completed' },
        { lead_id: null, visit_date: '2026-07-10', status: 'completed' },
        { lead_id: 'walk-in', visit_date: '2026-07-10', status: 'completed' },
      ],
      enrollments,
      { dateStart: '2026-07-01', dateEnd: '2026-07-18' },
    );
    expect(map.get('test')!.offline_visits).toBe(1);
  });

  it('counts paid tickets per checkout, dual-campaign full credit, unique org totals', () => {
    const map = new Map();
    const enrollments = [
      {
        campaign_id: 'test',
        is_follower_at_start: null,
        became_follower_at: null,
        lead_id: 'person-a',
        created_at: '2026-05-01T10:00:00.000Z',
      },
      {
        campaign_id: 'juli',
        is_follower_at_start: null,
        became_follower_at: null,
        lead_id: 'person-a',
        created_at: '2026-06-01T10:00:00.000Z',
      },
    ];
    const uniquePaid = applyPaidSalesActivitiesToMetrics(
      map,
      [
        {
          id: 'tx-1',
          lead_id: 'person-a',
          date: '2026-07-10',
          payment_status: 'paid',
          is_paid: true,
          total_amount: 40_000,
          total_paid_amount: 40_000,
        },
        {
          id: 'tx-2',
          lead_id: 'person-a',
          date: '2026-07-12',
          payment_status: 'paid',
          is_paid: true,
          total_amount: 20_000,
          total_paid_amount: 20_000,
        },
        {
          id: 'tx-unpaid',
          lead_id: 'person-a',
          date: '2026-07-11',
          payment_status: 'unpaid',
          is_paid: false,
          total_amount: 99_000,
          total_paid_amount: 0,
        },
        {
          id: 'tx-null-lead',
          lead_id: null,
          date: '2026-07-10',
          payment_status: 'paid',
          is_paid: true,
          total_amount: 15_000,
          total_paid_amount: 15_000,
        },
        {
          id: 'tx-out-of-range',
          lead_id: 'person-a',
          date: '2026-05-02',
          payment_status: 'paid',
          is_paid: true,
          total_amount: 8_000,
          total_paid_amount: 8_000,
        },
      ],
      enrollments,
      { dateStart: '2026-07-01', dateEnd: '2026-07-18' },
    );

    expect(map.get('test')!.transactions).toBe(2);
    expect(map.get('test')!.revenue).toBe(60_000);
    expect(map.get('test')!.aov).toBe(30_000);
    expect(map.get('juli')!.transactions).toBe(2);
    expect(map.get('juli')!.revenue).toBe(60_000);
    expect(uniquePaid).toEqual({ transactions: 2, revenue: 60_000 });
    expect(sumCampaignListMetricTotals(map, uniquePaid)).toEqual({
      new_leads: 0,
      offline_visits: 0,
      new_followers: 0,
      new_emails: 0,
      new_phones: 0,
      transactions: 2,
      revenue: 60_000,
      aov: 30_000,
    });
  });
});
