/** Distinct chart colors per organic social platform. */
export const SOCIAL_INSIGHT_CHART_PLATFORMS = [
  "tiktok",
  "youtube",
  "linkedin",
  "threads",
  "instagram",
  "facebook",
] as const;

export type SocialInsightChartPlatform = (typeof SOCIAL_INSIGHT_CHART_PLATFORMS)[number];

export const SOCIAL_INSIGHT_CHART_COLORS: Record<SocialInsightChartPlatform, string> = {
  tiktok: "hsl(0 0% 9%)",
  youtube: "hsl(0 78% 52%)",
  linkedin: "hsl(201 70% 42%)",
  threads: "hsl(0 0% 20%)",
  instagram: "hsl(330 75% 48%)",
  facebook: "hsl(221 44% 41%)",
};
