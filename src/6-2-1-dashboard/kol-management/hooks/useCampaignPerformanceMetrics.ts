import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { normalizeLegacyEngagementTarget } from "../utils/campaignTargets";

export interface CampaignMetrics {
  publishedPosts: number;
  totalPosts: number;
  reachProgress: number;
  engagementProgress: number;
  conversionProgress: number;
  totalReach?: number;
  totalEngagement?: number;
  totalConversions?: number;
  actualReach?: number;
  actualEngagement?: number;
  actualConversions?: number;
  targetReach?: number;
  targetEngagement?: number;
  targetConversions?: number;
}

type MetricRow = {
  content_post_id: string;
  recorded_at: string;
  reach: number | null;
  impressions: number | null;
  engagement_rate: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
};

function latestMetricByPostId(rows: MetricRow[]): Map<string, MetricRow> {
  const m = new Map<string, MetricRow>();
  for (const r of rows) {
    const prev = m.get(r.content_post_id);
    if (!prev || new Date(r.recorded_at).getTime() > new Date(prev.recorded_at).getTime()) {
      m.set(r.content_post_id, r);
    }
  }
  return m;
}

function engagementRateFromMetric(m: MetricRow): number {
  const imp = Number(m.impressions || 0);
  const er = Number(m.engagement_rate || 0);
  if (imp > 0 && er > 0) return er;
  const interactions =
    Number(m.likes || 0) + Number(m.comments || 0) + Number(m.shares || 0);
  return imp > 0 ? (interactions / imp) * 100 : 0;
}

export const useCampaignPerformanceMetrics = () => {
  const { organizationId } = useCurrentOrg();

  const { data, isLoading, isPending } = useQuery({
    queryKey: ["campaign-performance-metrics", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) {
        return { campaigns: [], contentPosts: [], performanceMetrics: [], conversionCounts: {} as Record<string, number> };
      }

      const { data: campaigns, error: campaignsError } = await supabase
        .from("kol_campaigns")
        .select("*")
        .eq("organization_id", organizationId);

      if (campaignsError) {
        throw campaignsError;
      }

      const campaignIds = (campaigns || []).map((c: { id: string }) => c.id);

      let contentPosts: Array<{ id: string; campaign_id: string; status: string }> = [];
      if (campaignIds.length > 0) {
        const { data: posts, error: postsError } = await supabase
          .from("kol_content_posts")
          .select("id, campaign_id, status")
          .in("campaign_id", campaignIds)
          .eq("organization_id", organizationId);

        if (!postsError) {
          contentPosts = posts || [];
        }
      }

      const postIds = contentPosts.map((p) => p.id);
      let performanceMetrics: MetricRow[] = [];
      const conversionCounts: Record<string, number> = {};

      if (postIds.length > 0) {
        const { data: pm } = await supabase
          .from("kol_performance_metrics")
          .select(
            "content_post_id, recorded_at, reach, impressions, engagement_rate, likes, comments, shares",
          )
          .in("content_post_id", postIds);
        performanceMetrics = (pm || []) as MetricRow[];

        const { data: conv } = await supabase
          .from("kol_conversions")
          .select("content_post_id")
          .in("content_post_id", postIds);

        for (const row of conv || []) {
          const pid = row.content_post_id as string;
          conversionCounts[pid] = (conversionCounts[pid] || 0) + 1;
        }
      }

      return {
        campaigns: campaigns || [],
        contentPosts,
        performanceMetrics,
        conversionCounts,
      };
    },
  });

  const metricsByCampaign = useMemo(() => {
    const metrics: Record<string, CampaignMetrics> = {};
    if (!data) return metrics;

    const latestByPost = latestMetricByPostId(data.performanceMetrics);

    data.campaigns.forEach((campaign: {
      id: string;
      target_reach?: number | null;
      target_engagement?: number | null;
      target_conversion?: number | null;
    }) => {
      const posts = data.contentPosts.filter(
        (post) => post.campaign_id === campaign.id,
      );

      const publishedPosts = posts.filter(
        (post) => post.status === "published" || post.status === "completed",
      ).length;

      const totalPosts = posts.length;
      const published = posts.filter(
        (post) => post.status === "published" || post.status === "completed",
      );

      const targetReach = campaign.target_reach || 0;
      const targetEngagement =
        normalizeLegacyEngagementTarget(
          campaign.target_engagement,
          campaign.target_reach,
        ) || 0;
      const targetConversions = campaign.target_conversion || 0;

      let totalReach = 0;
      let engagementRates: number[] = [];
      let totalConversions = 0;

      for (const post of published) {
        const latest = latestByPost.get(post.id);
        if (latest) {
          totalReach += Number(latest.reach || 0);
          const rate = engagementRateFromMetric(latest);
          if (rate > 0) engagementRates.push(rate);
        }
        totalConversions += data.conversionCounts[post.id] || 0;
      }

      const actualEngagementRate =
        engagementRates.length > 0
          ? engagementRates.reduce((s, r) => s + r, 0) / engagementRates.length
          : 0;

      const reachProgress =
        targetReach > 0
          ? Math.min(100, Math.round((totalReach / targetReach) * 100))
          : 0;
      const engagementProgress =
        targetEngagement > 0
          ? Math.min(
              100,
              Math.round((actualEngagementRate / targetEngagement) * 100),
            )
          : 0;
      const conversionProgress =
        targetConversions > 0
          ? Math.min(
              100,
              Math.round((totalConversions / targetConversions) * 100),
            )
          : 0;

      metrics[campaign.id] = {
        publishedPosts,
        totalPosts,
        reachProgress,
        engagementProgress,
        conversionProgress,
        totalReach,
        totalEngagement: actualEngagementRate,
        totalConversions,
        actualReach: totalReach,
        actualEngagement: actualEngagementRate,
        actualConversions: totalConversions,
        targetReach,
        targetEngagement,
        targetConversions,
      };
    });

    return metrics;
  }, [data]);

  const getCampaignMetrics = (campaignId: string): CampaignMetrics | null => {
    return metricsByCampaign[campaignId] || null;
  };

  return {
    getCampaignMetrics,
    isLoading,
    isPending,
    metricsByCampaign,
  };
};
