import type { ScheduledPost } from '../types/scheduled-post';

const ACTIVE_STATUSES = new Set(['pending', 'publishing']);

export function getAccountIdFromProviderConfig(
  platform: string,
  providerConfig: Record<string, unknown> | null | undefined,
): string | null {
  const cfg = providerConfig ?? {};
  switch (platform.trim()) {
    case 'TikTok':
      return String(cfg.open_id ?? '').trim() || null;
    case 'YouTube':
      return String(cfg.channel_id ?? '').trim() || null;
    case 'Instagram':
      return String(cfg.instagram_business_account_id ?? '').trim() || null;
    case 'LinkedIn':
      return String(cfg.page_id ?? '').trim() || null;
    default:
      return null;
  }
}

export function pickAccountScheduleForModal(
  rows: ScheduledPost[],
  platform: string,
  accountId: string,
): ScheduledPost | null {
  const accountTrim = accountId.trim();
  const filtered = rows
    .filter((s) => {
      if (s.platform !== platform || s.status === 'cancelled') return false;
      const rowAccountId = getAccountIdFromProviderConfig(platform, s.provider_config);
      return rowAccountId === accountTrim;
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!filtered.length) return null;
  return filtered.find((s) => ACTIVE_STATUSES.has(s.status)) ?? filtered[0];
}

export function pickPlatformScheduleForModal(
  rows: ScheduledPost[],
  platform: string,
): ScheduledPost | null {
  const filtered = rows
    .filter((s) => s.platform === platform && s.status !== 'cancelled')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!filtered.length) return null;
  return filtered.find((s) => ACTIVE_STATUSES.has(s.status)) ?? filtered[0];
}

export function pickTikTokScheduleForModal(rows: ScheduledPost[]): ScheduledPost | null {
  return pickPlatformScheduleForModal(rows, 'TikTok');
}

export function pickYouTubeScheduleForModal(rows: ScheduledPost[]): ScheduledPost | null {
  return pickPlatformScheduleForModal(rows, 'YouTube');
}

export function pickInstagramScheduleForModal(rows: ScheduledPost[]): ScheduledPost | null {
  return pickPlatformScheduleForModal(rows, 'Instagram');
}

export function pickLinkedInScheduleForModal(rows: ScheduledPost[]): ScheduledPost | null {
  return pickPlatformScheduleForModal(rows, 'LinkedIn');
}

/** Dashboard post-link cell: only surface schedules that should override the link label. */
export function pickTikTokScheduleForTableCell(
  rows: ScheduledPost[],
  options?: { hasTikTokLink?: boolean; hasNonTiktokLinks?: boolean },
): ScheduledPost | null {
  const tiktok = rows
    .filter((s) => s.platform === 'TikTok' && s.status !== 'cancelled')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!tiktok.length) return null;

  const hasTikTokLink = options?.hasTikTokLink ?? false;
  const hasNonTiktokLinks = options?.hasNonTiktokLinks ?? false;
  const scheduleRelevant = hasTikTokLink || !hasNonTiktokLinks;
  if (!scheduleRelevant) return null;

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

export function buildScheduleByPlanId(
  rows: ScheduledPost[],
  linksByPlanId?: Record<string, Array<{ platform: string; url: string | null }>>,
): Record<string, ScheduledPost> {
  const byPlan = new Map<string, ScheduledPost[]>();
  for (const row of rows) {
    if (row.platform !== 'TikTok') continue;
    const list = byPlan.get(row.social_media_plan_id) ?? [];
    list.push(row);
    byPlan.set(row.social_media_plan_id, list);
  }

  const map: Record<string, ScheduledPost> = {};
  for (const [planId, planRows] of byPlan) {
    const planLinks = linksByPlanId?.[planId] ?? [];
    const linksWithUrl = planLinks.filter((l) => l.url?.trim());
    const picked = pickTikTokScheduleForTableCell(planRows, {
      hasTikTokLink: linksWithUrl.some((l) => l.platform === 'TikTok'),
      hasNonTiktokLinks: linksWithUrl.some((l) => l.platform !== 'TikTok'),
    });
    if (picked) map[planId] = picked;
  }
  return map;
}
