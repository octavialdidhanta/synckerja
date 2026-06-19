import type {
  SocialMediaInsightAccountRow,
  SocialMediaInsightContentRow,
  SocialMediaInsightMonthlyChartPoint,
  SocialMediaPlatform,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

const CHART_PLATFORMS: SocialMediaPlatform[] = [
  "tiktok",
  "youtube",
  "linkedin",
  "threads",
  "instagram",
  "facebook",
];

function emptyPlatformCounts(): Record<SocialMediaPlatform, number> {
  return { tiktok: 0, youtube: 0, linkedin: 0, threads: 0, instagram: 0, facebook: 0 };
}

type EngagementBucket = Record<SocialMediaPlatform, { views: number; engagements: number }>;

function emptyEngagementBuckets(): EngagementBucket {
  return {
    tiktok: { views: 0, engagements: 0 },
    youtube: { views: 0, engagements: 0 },
    linkedin: { views: 0, engagements: 0 },
    threads: { views: 0, engagements: 0 },
    instagram: { views: 0, engagements: 0 },
    facebook: { views: 0, engagements: 0 },
  };
}

function monthKeysBetween(startYmd: string, endYmd: string): string[] {
  const start = new Date(`${startYmd}T00:00:00`);
  const end = new Date(`${endYmd}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor.getTime() <= endMonth.getTime()) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    keys.push(`${y}-${m}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function monthLabel(monthKey: string, locale: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "short", year: "2-digit" });
}

function postedMonthKey(postedAt: string | null): string | null {
  if (!postedAt) return null;
  const d = new Date(postedAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sumPlatformCounts(b: Record<SocialMediaPlatform, number>): number {
  return CHART_PLATFORMS.reduce((sum, platform) => sum + b[platform], 0);
}

function toMonthlyChartPoint(
  monthKey: string,
  locale: string,
  counts: Record<SocialMediaPlatform, number>,
): SocialMediaInsightMonthlyChartPoint {
  return {
    monthKey,
    monthLabel: monthLabel(monthKey, locale),
    tiktok: counts.tiktok,
    youtube: counts.youtube,
    linkedin: counts.linkedin,
    threads: counts.threads,
    instagram: counts.instagram,
    facebook: counts.facebook,
    total: sumPlatformCounts(counts),
  };
}

export function buildMonthlyViewsChartPoints(
  rows: SocialMediaInsightContentRow[],
  dateStart: string,
  dateEnd: string,
  locale: string,
): SocialMediaInsightMonthlyChartPoint[] {
  const monthKeys = monthKeysBetween(dateStart, dateEnd);
  const buckets = new Map(monthKeys.map((k) => [k, emptyPlatformCounts()]));

  for (const row of rows) {
    const key = postedMonthKey(row.postedAt);
    if (!key || !buckets.has(key)) continue;
    buckets.get(key)![row.platform] += row.viewCount;
  }

  return monthKeys.map((monthKey) =>
    toMonthlyChartPoint(monthKey, locale, buckets.get(monthKey)!),
  );
}

export function buildMonthlyContentChartPoints(
  rows: SocialMediaInsightContentRow[],
  dateStart: string,
  dateEnd: string,
  locale: string,
): SocialMediaInsightMonthlyChartPoint[] {
  const monthKeys = monthKeysBetween(dateStart, dateEnd);
  const buckets = new Map(monthKeys.map((k) => [k, emptyPlatformCounts()]));

  for (const row of rows) {
    const key = postedMonthKey(row.postedAt);
    if (!key || !buckets.has(key)) continue;
    buckets.get(key)![row.platform] += 1;
  }

  return monthKeys.map((monthKey) =>
    toMonthlyChartPoint(monthKey, locale, buckets.get(monthKey)!),
  );
}

export function buildMonthlyEngagementChartPoints(
  rows: SocialMediaInsightContentRow[],
  dateStart: string,
  dateEnd: string,
  locale: string,
): SocialMediaInsightMonthlyChartPoint[] {
  const monthKeys = monthKeysBetween(dateStart, dateEnd);
  const buckets = new Map(monthKeys.map((k) => [k, emptyEngagementBuckets()]));

  for (const row of rows) {
    const key = postedMonthKey(row.postedAt);
    if (!key || !buckets.has(key)) continue;
    const b = buckets.get(key)![row.platform];
    const engagements = row.likeCount + row.commentCount + row.shareCount;
    b.views += row.viewCount;
    b.engagements += engagements;
  }

  const engagementRate = (p: { views: number; engagements: number }) =>
    p.views > 0 ? (p.engagements / p.views) * 100 : 0;

  return monthKeys.map((monthKey) => {
    const bucket = buckets.get(monthKey)!;
    const tiktok = engagementRate(bucket.tiktok);
    const youtube = engagementRate(bucket.youtube);
    const linkedin = engagementRate(bucket.linkedin);
    const threads = engagementRate(bucket.threads);
    const instagram = engagementRate(bucket.instagram);
    const facebook = engagementRate(bucket.facebook);
    const totalViews = CHART_PLATFORMS.reduce((sum, platform) => sum + bucket[platform].views, 0);
    const totalEng = CHART_PLATFORMS.reduce(
      (sum, platform) => sum + bucket[platform].engagements,
      0,
    );
    const total = totalViews > 0 ? (totalEng / totalViews) * 100 : 0;
    return {
      monthKey,
      monthLabel: monthLabel(monthKey, locale),
      tiktok,
      youtube,
      linkedin,
      threads,
      instagram,
      facebook,
      total,
    };
  });
}

export function buildMonthlyViewsByPlatformTotals(
  rows: SocialMediaInsightContentRow[],
): { platform: SocialMediaPlatform; views: number }[] {
  const totals = emptyPlatformCounts();
  for (const row of rows) {
    totals[row.platform] += row.viewCount;
  }
  return CHART_PLATFORMS.map((platform) => ({ platform, views: totals[platform] }));
}

export function computeInsightSummary(
  accounts: SocialMediaInsightAccountRow[],
): import("@/6-0-social-media-performance-shared/socialMediaInsightTypes").SocialMediaInsightSummary {
  const connected = accounts.filter((a) => a.connected && !a.isPlatformPlaceholder);
  let audienceSum = 0;
  let hasAudience = false;
  for (const a of connected) {
    if (a.audienceCount != null && !a.audienceHidden) {
      audienceSum += a.audienceCount;
      hasAudience = true;
    }
  }

  const totalViews = connected.reduce((s, a) => s + a.totalViews, 0);
  const totalLikes = connected.reduce((s, a) => s + a.totalLikes, 0);
  const totalComments = connected.reduce((s, a) => s + a.totalComments, 0);
  const totalShares = connected.reduce((s, a) => s + a.totalShares, 0);
  let engagementWeighted = 0;
  let engagementWeight = 0;
  for (const a of connected) {
    if (a.avgEngagementRate != null && a.totalViews > 0) {
      engagementWeighted += a.avgEngagementRate * a.totalViews;
      engagementWeight += a.totalViews;
    }
  }

  return {
    totalAudience: hasAudience ? audienceSum : null,
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    avgEngagementRate:
      engagementWeight > 0 ? engagementWeighted / engagementWeight : null,
  };
}
