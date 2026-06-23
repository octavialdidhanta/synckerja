import type { ScheduledPost } from '../types/scheduled-post';

const ACTIVE_STATUSES = new Set(['pending', 'publishing']);

/** Modal / detail: show active schedule first, else latest non-cancelled TikTok row. */
export function pickTikTokScheduleForModal(rows: ScheduledPost[]): ScheduledPost | null {
  const tiktok = rows
    .filter((s) => s.platform === 'TikTok' && s.status !== 'cancelled')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!tiktok.length) return null;
  return tiktok.find((s) => ACTIVE_STATUSES.has(s.status)) ?? tiktok[0];
}

/**
 * Dashboard post-link cell: only surface schedules that should override the link label.
 * Published (or stale failed after success) → null so the TikTok URL is shown instead.
 */
export function pickTikTokScheduleForTableCell(rows: ScheduledPost[]): ScheduledPost | null {
  const tiktok = rows
    .filter((s) => s.platform === 'TikTok' && s.status !== 'cancelled')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!tiktok.length) return null;

  const active = tiktok.find((s) => ACTIVE_STATUSES.has(s.status));
  if (active) return active;

  const latest = tiktok[0];
  if (latest.status === 'published') return null;

  if (latest.status === 'failed') {
    const hasNewerPublished = tiktok.some(
      (s) => s.status === 'published' && Date.parse(s.created_at) > Date.parse(latest.created_at),
    );
    if (hasNewerPublished) return null;
    return latest;
  }

  return latest;
}

export function buildScheduleByPlanId(rows: ScheduledPost[]): Record<string, ScheduledPost> {
  const byPlan = new Map<string, ScheduledPost[]>();
  for (const row of rows) {
    if (row.platform !== 'TikTok') continue;
    const list = byPlan.get(row.social_media_plan_id) ?? [];
    list.push(row);
    byPlan.set(row.social_media_plan_id, list);
  }

  const map: Record<string, ScheduledPost> = {};
  for (const [planId, planRows] of byPlan) {
    const picked = pickTikTokScheduleForTableCell(planRows);
    if (picked) map[planId] = picked;
  }
  return map;
}
