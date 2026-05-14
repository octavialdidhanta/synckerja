import type { WhatsappCycleMetricRow } from '@/5-3-dashboard/hooks/useLeadsInsightsSupplementalQueries';
import type { CrmAssigneeSegment } from '@/5-3-dashboard/hooks/useCrmFirstResponsePerRoom';
import type { ConversationSummaryChannelKey, ConversationSummaryPeriodKey } from '@/5-3-dashboard/components/crm/crmConversationSummaryMetrics';

const MS_PER_DAY = 86_400_000;

/** Default: all assigned-role buckets (excludes `unassigned` rooms). */
export const DEFAULT_CRM_METRIC_ROLE_SEGMENTS: ReadonlySet<CrmAssigneeSegment> = new Set([
  'admin',
  'supervisor',
  'agent',
]);

export function normalizeCrmAssigneeSegment(raw: string | null | undefined): CrmAssigneeSegment {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'admin' || s === 'supervisor' || s === 'agent' || s === 'unassigned') return s;
  return 'unassigned';
}

/**
 * When `allowed` is null or empty, no segment filter (includes unassigned).
 * Otherwise keep rows whose `crm_assignee_segment` is in `allowed`.
 */
export function filterRowsByCrmAssigneeSegments<T extends { crm_assignee_segment?: string | null }>(
  rows: T[],
  allowed: ReadonlySet<CrmAssigneeSegment> | null,
): T[] {
  if (allowed == null || allowed.size === 0) return rows;
  return rows.filter((r) => allowed.has(normalizeCrmAssigneeSegment(r.crm_assignee_segment)));
}

/** Rolling N-day window on `cycle_started_at` (browser clock). Invalid / missing → excluded when period !== all. */
export function cycleStartedAtWithinPeriod(
  cycleStartedAt: string | null | undefined,
  periodKey: ConversationSummaryPeriodKey,
): boolean {
  if (periodKey === 'all') return true;
  const days = Number(periodKey);
  const raw = cycleStartedAt;
  if (raw == null || String(raw).trim() === '') return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * MS_PER_DAY;
}

/** Rolling N-day window on `resolved_at` (browser clock). Excludes unresolved when period !== all. */
export function resolvedAtWithinPeriod(
  resolvedAt: string | null | undefined,
  periodKey: ConversationSummaryPeriodKey,
): boolean {
  if (periodKey === 'all') return true;
  const days = Number(periodKey);
  const raw = resolvedAt;
  if (raw == null || String(raw).trim() === '') return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * MS_PER_DAY;
}

export function cycleStartedWithinPeriod(
  row: WhatsappCycleMetricRow,
  periodKey: ConversationSummaryPeriodKey,
): boolean {
  return cycleStartedAtWithinPeriod(row.cycle_started_at, periodKey);
}

export function conversationChannelMatches(
  channelFromRow: string | null | undefined,
  filterChannel: ConversationSummaryChannelKey,
): boolean {
  if (filterChannel === 'all') return true;
  const ch = String(channelFromRow ?? 'whatsapp')
    .trim()
    .toLowerCase();
  if (filterChannel === 'whatsapp') return ch === 'whatsapp' || ch === '';
  if (filterChannel === 'instagram') return ch === 'instagram';
  if (filterChannel === 'email') return ch === 'email';
  return true;
}

export function cycleMatchesChannelFilter(
  row: WhatsappCycleMetricRow,
  channel: ConversationSummaryChannelKey,
): boolean {
  return conversationChannelMatches(row.channel, channel);
}

export function filterCycleRowsForPerformance(
  rows: WhatsappCycleMetricRow[],
  period: ConversationSummaryPeriodKey,
  channel: ConversationSummaryChannelKey,
): WhatsappCycleMetricRow[] {
  return rows.filter(
    (r) => cycleStartedWithinPeriod(r, period) && cycleMatchesChannelFilter(r, channel),
  );
}

export type CyclePerformanceAggregates = {
  avgFirstResponseMs: number | null;
  avgResolutionMs: number | null;
  /** Mean(resolved_at − first_response_at) when both exist — handling time after first agent reply. */
  avgResponseAfterFirstMs: number | null;
  sampleFirst: number;
  sampleResolve: number;
  sampleHandle: number;
};

/** Timing fields used by CRM per-room RPC rows (latest open/closed cycle per conversation). */
export type CrmCycleTimingRow = {
  cycle_started_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  channel?: string | null;
  crm_assignee_segment?: string | null;
};

/**
 * Same cohort as {@link CrmFirstResponsePerRoomSection}: rolling period on `cycle_started_at` + channel.
 * (Search text in the table does not apply here — org-wide numeric average for the filter.)
 */
export function filterCrmRowsLikeFirstResponseTable(
  rows: CrmCycleTimingRow[],
  period: ConversationSummaryPeriodKey,
  channel: ConversationSummaryChannelKey,
): CrmCycleTimingRow[] {
  return rows.filter(
    (r) =>
      cycleStartedAtWithinPeriod(r.cycle_started_at, period) &&
      conversationChannelMatches(r.channel, channel),
  );
}

/**
 * Same cohort as {@link CrmResolutionPerRoomSection}: rolling period on `resolved_at` + channel.
 */
export function filterCrmRowsLikeResolutionTable(
  rows: CrmCycleTimingRow[],
  period: ConversationSummaryPeriodKey,
  channel: ConversationSummaryChannelKey,
): CrmCycleTimingRow[] {
  return rows.filter(
    (r) =>
      resolvedAtWithinPeriod(r.resolved_at, period) && conversationChannelMatches(r.channel, channel),
  );
}

/**
 * Averages for CRM "Performance per time" aligned with the two per-room tables below:
 * - First card: mean(first_response − cycle_start) over `firstResponseTableCohort`.
 * - Second card: mean(resolved − cycle_start) over `resolutionCohortForResolutionTime` (no role filter in UI).
 * - Third card: mean(resolved − first_response) over `resolutionCohortForAfterFirst` (role filter when applied).
 */
export function aggregateCrmDashboardFromCohorts(
  firstResponseTableCohort: CrmCycleTimingRow[],
  resolutionCohortForResolutionTime: CrmCycleTimingRow[],
  resolutionCohortForAfterFirst: CrmCycleTimingRow[],
): CyclePerformanceAggregates {
  const firstDurations: number[] = [];
  for (const r of firstResponseTableCohort) {
    const start = new Date(r.cycle_started_at).getTime();
    if (Number.isNaN(start)) continue;
    if (r.first_response_at) {
      const first = new Date(r.first_response_at).getTime();
      if (!Number.isNaN(first) && first >= start) {
        firstDurations.push(first - start);
      }
    }
  }

  const resolveFromStart: number[] = [];
  for (const r of resolutionCohortForResolutionTime) {
    const start = new Date(r.cycle_started_at).getTime();
    if (Number.isNaN(start)) continue;
    if (r.resolved_at) {
      const res = new Date(r.resolved_at).getTime();
      if (!Number.isNaN(res) && res >= start) {
        resolveFromStart.push(res - start);
      }
    }
  }

  const handleAfterFirst: number[] = [];
  for (const r of resolutionCohortForAfterFirst) {
    const start = new Date(r.cycle_started_at).getTime();
    if (Number.isNaN(start)) continue;
    if (r.resolved_at) {
      const res = new Date(r.resolved_at).getTime();
      if (!Number.isNaN(res) && res >= start) {
        if (r.first_response_at) {
          const first = new Date(r.first_response_at).getTime();
          if (!Number.isNaN(first) && res >= first) {
            handleAfterFirst.push(res - first);
          }
        }
      }
    }
  }

  const avg = (arr: number[]): number | null =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    avgFirstResponseMs: avg(firstDurations),
    avgResolutionMs: avg(resolveFromStart),
    avgResponseAfterFirstMs: avg(handleAfterFirst),
    sampleFirst: firstDurations.length,
    sampleResolve: resolveFromStart.length,
    sampleHandle: handleAfterFirst.length,
  };
}

export function aggregateCyclePerformance(rows: WhatsappCycleMetricRow[]): CyclePerformanceAggregates {
  const firstDurations: number[] = [];
  const resolveFromStart: number[] = [];
  const handleAfterFirst: number[] = [];

  for (const r of rows) {
    const start = new Date(r.cycle_started_at).getTime();
    if (Number.isNaN(start)) continue;

    if (r.first_response_at) {
      const first = new Date(r.first_response_at).getTime();
      if (!Number.isNaN(first) && first >= start) {
        firstDurations.push(first - start);
      }
    }
    if (r.resolved_at) {
      const res = new Date(r.resolved_at).getTime();
      if (!Number.isNaN(res) && res >= start) {
        resolveFromStart.push(res - start);
        if (r.first_response_at) {
          const first = new Date(r.first_response_at).getTime();
          if (!Number.isNaN(first) && res >= first) {
            handleAfterFirst.push(res - first);
          }
        }
      }
    }
  }

  const avg = (arr: number[]): number | null =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    avgFirstResponseMs: avg(firstDurations),
    avgResolutionMs: avg(resolveFromStart),
    avgResponseAfterFirstMs: avg(handleAfterFirst),
    sampleFirst: firstDurations.length,
    sampleResolve: resolveFromStart.length,
    sampleHandle: handleAfterFirst.length,
  };
}

/** HH:MM:SS for dashboard display */
export function formatDurationHMS(ms: number | null): string {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
