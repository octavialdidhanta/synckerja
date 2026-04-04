import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

export interface MonthlyTrendPoint {
  key: string;
  name: string;
  reach: number;
  engagement: number;
  conversions: number;
}

function monthKeyLocalFromIso(iso: string): string {
  const dt = new Date(iso);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 6 bulan terakhir (kalender rolling dari bulan berjalan): reach & engagement dari
 * snapshot metrik terbaru per content post, di-bucket menurut tanggal post (`post_date` atau `created_at`);
 * konversi di-bucket menurut `conversion_date`.
 */
export const useKOLAnalyticsMonthlyTrends = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ["kol-analytics-monthly-trends", organizationId],
    enabled: !!organizationId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<MonthlyTrendPoint[]> => {
      if (!organizationId) return [];

      const { data: posts, error: postsError } = await supabase
        .from("kol_content_posts")
        .select("id, post_date, created_at, kol_profile_id")
        .eq("organization_id", organizationId);

      if (postsError) throw postsError;

      const list = posts || [];
      const postIds = list.map((p) => p.id).filter(Boolean);

      const kolIdsForPosts = [...new Set(list.map((p) => p.kol_profile_id).filter(Boolean))] as string[];
      let followerSumByKol = new Map<string, number>();
      if (kolIdsForPosts.length > 0) {
        const { data: accounts, error: accErr } = await supabase
          .from("kol_social_media_accounts")
          .select("kol_profile_id, followers")
          .in("kol_profile_id", kolIdsForPosts);
        if (accErr) {
          console.error("Error fetching social accounts for monthly trends:", accErr);
        } else {
          for (const a of accounts || []) {
            const id = a.kol_profile_id as string;
            followerSumByKol.set(id, (followerSumByKol.get(id) || 0) + Number(a.followers || 0));
          }
        }
      }

      let metricsRows: {
        content_post_id: string;
        recorded_at: string;
        reach: number | null;
        impressions: number | null;
        engagement_rate: number | null;
        likes: number | null;
        comments: number | null;
        shares: number | null;
        saves: number | null;
      }[] = [];

      if (postIds.length > 0) {
        const { data: m, error: mErr } = await supabase
          .from("kol_performance_metrics")
          .select(
            "content_post_id, recorded_at, reach, impressions, engagement_rate, likes, comments, shares, saves",
          )
          .in("content_post_id", postIds);

        if (mErr) {
          console.error("Error fetching performance metrics for trends:", mErr);
        } else {
          metricsRows = (m || []) as typeof metricsRows;
        }
      }

      const latestByPost = new Map<string, (typeof metricsRows)[0]>();
      for (const r of metricsRows) {
        const prev = latestByPost.get(r.content_post_id);
        if (!prev || new Date(r.recorded_at).getTime() > new Date(prev.recorded_at).getTime()) {
          latestByPost.set(r.content_post_id, r);
        }
      }

      const { data: convRows, error: convError } = await supabase
        .from("kol_conversions")
        .select("conversion_date")
        .eq("organization_id", organizationId);

      if (convError) {
        console.error("Error fetching conversions for trends:", convError);
      }

      const now = new Date();
      const buckets = new Map<string, MonthlyTrendPoint>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const name = d.toLocaleDateString("id-ID", { month: "short" });
        buckets.set(key, { key, name, reach: 0, engagement: 0, conversions: 0 });
      }

      const keySet = new Set(buckets.keys());

      /** Satu kontribusi followers per KOL per bulan (hindari double-count banyak post tanpa metrik). */
      const followerCountedByMonth = new Map<string, Set<string>>();
      const takeFollowerReachOnce = (monthKey: string, kol: string | null): number => {
        if (!kol) return 0;
        const followers = followerSumByKol.get(kol) || 0;
        if (followers <= 0) return 0;
        let counted = followerCountedByMonth.get(monthKey);
        if (!counted) {
          counted = new Set();
          followerCountedByMonth.set(monthKey, counted);
        }
        if (counted.has(kol)) return 0;
        counted.add(kol);
        return followers;
      };

      for (const p of list) {
        const anchor = p.post_date || p.created_at;
        if (!anchor) continue;

        const mk = monthKeyLocalFromIso(anchor);
        if (!keySet.has(mk)) continue;

        const b = buckets.get(mk)!;
        const meta = latestByPost.get(p.id);
        const kolId = p.kol_profile_id as string | null;

        let reachAdd = 0;
        let engagementAdd = 0;

        if (meta) {
          reachAdd = Number(meta.reach || 0);
          const interactions =
            Number(meta.likes || 0) +
            Number(meta.comments || 0) +
            Number(meta.shares || 0) +
            Number(meta.saves || 0);
          const imp = Number(meta.impressions || 0);
          const er = Number(meta.engagement_rate || 0);
          const impressionEngagement =
            interactions === 0 && imp > 0 && er > 0 ? Math.round((imp * er) / 100) : 0;
          engagementAdd = interactions + impressionEngagement;

          if (reachAdd === 0 && imp === 0 && kolId) {
            reachAdd = takeFollowerReachOnce(mk, kolId);
          }
        } else if (kolId) {
          reachAdd = takeFollowerReachOnce(mk, kolId);
        }

        b.reach += reachAdd;
        b.engagement += engagementAdd;
      }

      for (const c of convRows || []) {
        if (!c.conversion_date) continue;
        const mk = monthKeyLocalFromIso(c.conversion_date);
        if (!keySet.has(mk)) continue;
        buckets.get(mk)!.conversions += 1;
      }

      return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
    },
  });
};
