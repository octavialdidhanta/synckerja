import { describe, expect, it } from 'vitest';
import {
  aggregateCrmDashboardFromCohorts,
  filterRowsByCrmAssigneeSegments,
  normalizeCrmAssigneeSegment,
} from '@/5-3-dashboard/components/crm/crmPerformancePerTimeMetrics';

describe('normalizeCrmAssigneeSegment', () => {
  it('normalizes known segments case-insensitively', () => {
    expect(normalizeCrmAssigneeSegment('Admin')).toBe('admin');
    expect(normalizeCrmAssigneeSegment(' SUPERVISOR ')).toBe('supervisor');
    expect(normalizeCrmAssigneeSegment('agent')).toBe('agent');
    expect(normalizeCrmAssigneeSegment('unassigned')).toBe('unassigned');
  });

  it('maps unknown to unassigned', () => {
    expect(normalizeCrmAssigneeSegment('')).toBe('unassigned');
    expect(normalizeCrmAssigneeSegment(null)).toBe('unassigned');
    expect(normalizeCrmAssigneeSegment('other')).toBe('unassigned');
  });
});

describe('filterRowsByCrmAssigneeSegments', () => {
  const rows = [
    { id: 'a', crm_assignee_segment: 'agent' as const },
    { id: 'u', crm_assignee_segment: 'unassigned' as const },
  ];

  it('passes through when allowed is null', () => {
    expect(filterRowsByCrmAssigneeSegments(rows, null)).toEqual(rows);
  });

  it('passes through when allowed is empty', () => {
    expect(filterRowsByCrmAssigneeSegments(rows, new Set())).toEqual(rows);
  });

  it('keeps only rows in allowed set', () => {
    expect(filterRowsByCrmAssigneeSegments(rows, new Set(['agent']))).toEqual([rows[0]]);
  });
});

describe('aggregateCrmDashboardFromCohorts', () => {
  const t0 = '2025-06-01T00:00:00.000Z';
  const tFirst = '2025-06-01T00:00:10.000Z';
  const tRes = '2025-06-01T00:00:30.000Z';

  const row = (segment: string) => ({
    cycle_started_at: t0,
    first_response_at: tFirst,
    resolved_at: tRes,
    channel: 'whatsapp',
    crm_assignee_segment: segment,
  });

  it('uses second arg only for resolution-from-start (card 2)', () => {
    const first = [row('agent')];
    const resolutionFull = [row('agent'), row('unassigned')];
    const resolutionFiltered = [row('agent')];
    const a = aggregateCrmDashboardFromCohorts(first, resolutionFull, resolutionFiltered);
    expect(a.sampleResolve).toBe(2);
    expect(a.sampleHandle).toBe(1);
  });

  it('computes averages from timing fields', () => {
    const r = row('admin');
    const a = aggregateCrmDashboardFromCohorts([r], [r], [r]);
    expect(a.sampleFirst).toBe(1);
    expect(a.avgFirstResponseMs).toBe(10_000);
    expect(a.avgResolutionMs).toBe(30_000);
    expect(a.avgResponseAfterFirstMs).toBe(20_000);
  });
});
