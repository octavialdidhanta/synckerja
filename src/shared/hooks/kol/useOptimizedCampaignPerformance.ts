import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

/** Matches reference `CampaignPerformanceData` plus UI aliases used by `EnhancedKOLAnalyticsTab`. */
export interface CampaignPerformanceData {
  campaign_id: string;
  campaign_name: string;
  total_reach: number;
  total_engagement: number;
  total_conversions: number;
  engagement_rate: number;
  conversion_rate: number;
  total_spent: number;
  total_budget: number;
  kol_count: number;
  content_post_count: number;
  start_date?: string;
  end_date?: string;
  status: string;
  /** Alias for `kol_count` (reference UI). */
  total_kols: number;
  /** Alias for `engagement_rate` (reference UI). */
  avg_engagement_rate: number;
}

type MetricRow = {
  content_post_id: string;
  recorded_at: string;
  reach: number | null;
  impressions: number | null;
  engagement_rate: number | null;
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

/**
 * Performa kampanye: metrik terbaru per post + konversi; jika reach/impressions masih 0,
 * fallback jumlah followers akun sosial KOL pada post kampanye tersebut (data nyata).
 */
export const useOptimizedCampaignPerformance = () => {
  const { organizationId } = useCurrentOrg();

  const { data: campaignPerformance = [], isLoading, isPending } = useQuery({
    queryKey: ["optimized-campaign-performance", organizationId],
    queryFn: async (): Promise<CampaignPerformanceData[]> => {
      if (!organizationId) return [];

      try {
        const { data: campaigns, error: campaignsError } = await supabase
          .from("kol_campaigns")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false });

        if (campaignsError) {
          console.error("Error fetching campaigns:", campaignsError);
          throw campaignsError;
        }

        if (!campaigns || campaigns.length === 0) {
          return [];
        }

        const campaignIds = campaigns.map((c) => c.id);

        let spentByCampaign = new Map<string, number>();
        if (campaignIds.length > 0) {
          const { data: budgetRows, error: budgetError } = await supabase
            .from("kol_campaign_budget_allocations")
            .select("campaign_id, actual_payout, allocated_budget")
            .in("campaign_id", campaignIds);

          if (budgetError) {
            console.error("Error fetching budget allocations:", budgetError);
          } else {
            for (const row of budgetRows || []) {
              const cid = row.campaign_id as string;
              const spent =
                Number(row.actual_payout) > 0
                  ? Number(row.actual_payout)
                  : Number(row.allocated_budget || 0);
              spentByCampaign.set(cid, (spentByCampaign.get(cid) || 0) + spent);
            }
          }
        }

        const { data: contentPosts, error: postsError } = await supabase
          .from("kol_content_posts")
          .select("id, campaign_id, kol_profile_id")
          .in("campaign_id", campaignIds)
          .eq("organization_id", organizationId);

        if (postsError) {
          console.error("Error fetching content posts:", postsError);
        }

        const postIds = (contentPosts || []).map((p) => p.id);

        let performanceMetrics: MetricRow[] = [];
        let conversionsRows: { content_post_id: string; conversion_value: number | null }[] = [];

        if (postIds.length > 0) {
          const { data: pm, error: metricsError } = await supabase
            .from("kol_performance_metrics")
            .select("content_post_id, recorded_at, reach, impressions, engagement_rate")
            .in("content_post_id", postIds);

          if (metricsError) {
            console.error("Error fetching performance metrics:", metricsError);
          } else {
            performanceMetrics = (pm || []) as MetricRow[];
          }

          const { data: conv, error: conversionsError } = await supabase
            .from("kol_conversions")
            .select("content_post_id, conversion_value")
            .in("content_post_id", postIds);

          if (conversionsError) {
            console.error("Error fetching conversions:", conversionsError);
          } else {
            conversionsRows = (conv || []) as typeof conversionsRows;
          }
        }

        const latestByPost = latestMetricByPostId(performanceMetrics);

        const uniqueKolIds = [
          ...new Set((contentPosts || []).map((p) => p.kol_profile_id).filter(Boolean)),
        ] as string[];

        let followerSumByKol = new Map<string, number>();
        if (uniqueKolIds.length > 0) {
          const { data: accounts, error: accErr } = await supabase
            .from("kol_social_media_accounts")
            .select("kol_profile_id, followers")
            .in("kol_profile_id", uniqueKolIds);

          if (accErr) {
            console.error("Error fetching social accounts for campaign reach fallback:", accErr);
          } else {
            for (const a of accounts || []) {
              const id = a.kol_profile_id as string;
              followerSumByKol.set(
                id,
                (followerSumByKol.get(id) || 0) + Number(a.followers || 0),
              );
            }
          }
        }

        const performanceData: CampaignPerformanceData[] = (campaigns as any[]).map((campaign: any) => {
          const campaignPosts = (contentPosts || []).filter((p) => p.campaign_id === campaign.id) || [];
          const postIdsForCampaign = campaignPosts.map((p) => p.id);

          const campaignLatestRows = postIdsForCampaign
            .map((pid) => latestByPost.get(pid))
            .filter(Boolean) as MetricRow[];

          let totalReach = campaignLatestRows.reduce((sum, m) => sum + (m.reach || 0), 0);
          const totalImpressions = campaignLatestRows.reduce((sum, m) => sum + (m.impressions || 0), 0);
          const totalEngagement = campaignLatestRows.reduce((sum, m) => {
            const imp = m.impressions || 0;
            const er = m.engagement_rate || 0;
            return sum + (imp > 0 ? (imp * er) / 100 : 0);
          }, 0);

          const campaignConversions = conversionsRows.filter((c) => postIdsForCampaign.includes(c.content_post_id));
          const totalConversions = campaignConversions.length;

          if (totalReach === 0 && totalImpressions === 0 && campaignPosts.length > 0) {
            const kolIds = [...new Set(campaignPosts.map((p) => p.kol_profile_id).filter(Boolean))] as string[];
            const fallbackReach = kolIds.reduce((s, kid) => s + (followerSumByKol.get(kid) || 0), 0);
            if (fallbackReach > 0) {
              totalReach = fallbackReach;
            }
          }

          const uniqueKOLs = new Set(campaignPosts.map((p) => p.kol_profile_id).filter(Boolean)).size;
          const engagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;
          const conversionRate = totalReach > 0 ? (totalConversions / totalReach) * 100 : 0;

          const kol_count = uniqueKOLs;
          const engagement_rate = engagementRate;

          return {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            total_reach: totalReach,
            total_engagement: Math.round(totalEngagement),
            total_conversions: totalConversions,
            engagement_rate,
            conversion_rate: conversionRate,
            total_spent: spentByCampaign.get(campaign.id) || 0,
            total_budget: campaign.budget || campaign.total_budget || 0,
            kol_count,
            content_post_count: campaignPosts.length,
            start_date: campaign.start_date,
            end_date: campaign.end_date,
            status: campaign.status,
            total_kols: kol_count,
            avg_engagement_rate: engagement_rate,
          };
        });

        return performanceData;
      } catch (error) {
        console.error("Error fetching optimized campaign performance:", error);
        if ((error as any)?.code === "PGRST116" || (error as any)?.message?.includes("404")) {
          console.warn("Some tables not found, returning empty array");
          return [];
        }
        throw error;
      }
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000,
  });

  return {
    data: campaignPerformance as CampaignPerformanceData[],
    isLoading,
    /** Initial fetch; false saat refetch background — gunakan untuk skeleton dashboard. */
    isPending,
  };
};
