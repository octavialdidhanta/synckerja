import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

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

export const useCampaignPerformanceMetrics = () => {
  const { organizationId } = useCurrentOrg();

  const { data, isLoading, isPending } = useQuery({
    queryKey: ["campaign-performance-metrics", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) {
        return { campaigns: [], contentPosts: [] };
      }

      const { data: campaigns, error: campaignsError } = await supabase
        .from("kol_campaigns")
        .select("*")
        .eq("organization_id", organizationId);

      if (campaignsError) {
        throw campaignsError;
      }

      const campaignIds = (campaigns || []).map((c: any) => c.id);

      let contentPosts: any[] = [];
      if (campaignIds.length > 0) {
        const { data: posts, error: postsError } = await supabase
          .from("kol_content_posts")
          .select("*")
          .in("campaign_id", campaignIds)
          .eq("organization_id", organizationId);

        if (!postsError) {
          contentPosts = posts || [];
        }
      }

      return {
        campaigns: campaigns || [],
        contentPosts,
      };
    },
  });

  const metricsByCampaign = useMemo(() => {
    const metrics: Record<string, CampaignMetrics> = {};
    if (!data) return metrics;

    data.campaigns.forEach((campaign: any) => {
      const posts = data.contentPosts.filter(
        (post: any) => post.campaign_id === campaign.id,
      );

      const publishedPosts = posts.filter(
        (post: any) =>
          post.status === "published" || post.status === "completed",
      ).length;

      const totalPosts = posts.length;

      const targetReach = campaign.target_reach || 0;
      const targetEngagement = campaign.target_engagement || 0;
      const targetConversions = campaign.target_conversion || 0;

      const published = posts.filter(
        (post: any) =>
          post.status === "published" || post.status === "completed",
      );

      const totalReach = published.reduce(
        (sum: number, post: any) => sum + (post.reach || 0),
        0,
      );

      const totalEngagement = published.reduce(
        (sum: number, post: any) => sum + (post.engagement || 0),
        0,
      );

      const totalConversions = published.reduce(
        (sum: number, post: any) => sum + (post.conversions || 0),
        0,
      );

      const reachProgress =
        targetReach > 0
          ? Math.min(100, Math.round((totalReach / targetReach) * 100))
          : 0;
      const engagementProgress =
        targetEngagement > 0
          ? Math.min(
              100,
              Math.round((totalEngagement / targetEngagement) * 100),
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
        totalEngagement,
        totalConversions,
        actualReach: totalReach,
        actualEngagement: totalEngagement,
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

