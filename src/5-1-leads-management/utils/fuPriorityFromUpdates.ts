/**
 * Calculate FU Priority from lead_follow_up_updates status counts using percentage.
 * Hot Prospect → High, Warm Prospect → Medium, Cold Prospect → Low.
 * The priority is the status with the highest percentage of total updates.
 * Tie-break: prefer Hot > Warm > Cold.
 */

const STATUS_KEYS = ['Hot Prospect', 'Warm Prospect', 'Cold Prospect'] as const;
const NORMALIZED: Record<string, (typeof STATUS_KEYS)[number]> = {
  'hot prospect': 'Hot Prospect',
  'warm prospect': 'Warm Prospect',
  'cold prospect': 'Cold Prospect',
};

function normalizeStatus(status: string | null | undefined): (typeof STATUS_KEYS)[number] | null {
  if (status == null || typeof status !== 'string') return null;
  const key = status.trim().toLowerCase().replace(/\s+/g, ' ');
  return NORMALIZED[key] ?? null;
}

export interface FuPriorityCounts {
  hot: number;
  warm: number;
  cold: number;
  total: number;
}

/**
 * Count Hot/Warm/Cold from update statuses (case-insensitive).
 */
export function countProspectStatuses(
  updates: Array<{ status?: string | null }>
): FuPriorityCounts {
  const counts = { hot: 0, warm: 0, cold: 0 };
  for (const u of updates) {
    const key = normalizeStatus(u.status);
    if (key === 'Hot Prospect') counts.hot++;
    else if (key === 'Warm Prospect') counts.warm++;
    else if (key === 'Cold Prospect') counts.cold++;
  }
  const total = counts.hot + counts.warm + counts.cold;
  return { ...counts, total };
}

/**
 * Compute FU Priority from counts using percentage: the status with the highest
 * percentage wins. Tie-break: Hot > Warm > Cold.
 * Returns 'High' | 'Medium' | 'Low' | null (null if no updates).
 */
export function fuPriorityFromCounts(counts: FuPriorityCounts): 'High' | 'Medium' | 'Low' | null {
  const { hot, warm, cold, total } = counts;
  if (total === 0) return null;

  const hotPct = (hot / total) * 100;
  const warmPct = (warm / total) * 100;
  const coldPct = (cold / total) * 100;

  // Status with highest percentage wins; tie-break: Hot > Warm > Cold
  const maxPct = Math.max(hotPct, warmPct, coldPct);
  if (hotPct === maxPct && maxPct > 0) return 'High';
  if (warmPct === maxPct && maxPct > 0) return 'Medium';
  if (coldPct === maxPct && maxPct > 0) return 'Low';
  return null;
}

/**
 * One-shot: from raw updates, return { followupCount, fuPriority }.
 */
export function computeFollowUpAndPriority(
  updates: Array<{ status?: string | null }>
): { followupCount: number; fuPriority: 'High' | 'Medium' | 'Low' | null } {
  const counts = countProspectStatuses(updates);
  return {
    followupCount: updates.length,
    fuPriority: fuPriorityFromCounts(counts),
  };
}
