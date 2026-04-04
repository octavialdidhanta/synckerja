import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

import type { KOLManagementFiltersType } from "../section/KOLManagementFilters";

export type KOLSocialAccount = {
  platform: string;
  followers: number;
  engagement_rate: number;
};

export type KOLProfileWithStats = {
  id: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  gender: string;
  category: string;
  status: string;
  followers_count: number;
  engagement_rate: number;
  profile_photo_url: string;
  active_campaigns: number;
  total_reach: number;
  social_accounts: KOLSocialAccount[];
  total_posts?: number;
  niche?: string;
  location?: string;
  specialties?: string;
};

export type KOLMetrics = {
  totalKOLs: number;
  activeKOLs: number;
  totalFollowers: number;
  totalCampaigns: number;
  activeCampaigns: number;
  avgEngagement: number;
};

type KolDataResponse = {
  profiles: any[];
  campaigns: any[];
  socialAccounts: any[];
};

const getExpectedColumnsFailure = (err: unknown) => {
  const message = String((err as any)?.message || "");
  const code = String((err as any)?.code || "");
  // Supabase/Postgres typical codes for missing relation/column.
  return (
    code === "42703" || // undefined column
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("column")
  );
};

export const useKOLManagementData = (filters: KOLManagementFiltersType) => {
  const { organizationId } = useCurrentOrg();

  const { data, isLoading, isPending } = useQuery({
    queryKey: ["kol-management-data", organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async (): Promise<KolDataResponse> => {
      if (!organizationId) return { profiles: [], campaigns: [], socialAccounts: [] };

      // Reference behavior: be defensive if some tables/relations are not ready yet.
      let profiles: any[] = [];
      let campaigns: any[] = [];
      let socialAccounts: any[] = [];

      try {
        const { data: profilesData, error } = await supabase
          .from("kol_profiles")
          .select("*")
          .eq("organization_id", organizationId);

        if (error) throw error;
        profiles = profilesData || [];
      } catch (err) {
        if (!getExpectedColumnsFailure(err)) throw err;
        profiles = [];
      }

      const profileIds = profiles.map((p) => p.id).filter(Boolean);
      if (profileIds.length > 0) {
        try {
          const { data: socialData, error } = await supabase
            .from("kol_social_media_accounts")
            .select("*")
            .in("kol_profile_id", profileIds);
          if (error) throw error;
          socialAccounts = socialData || [];
        } catch (err) {
          if (!getExpectedColumnsFailure(err)) throw err;
          socialAccounts = [];
        }
      }

      try {
        const { data: campaignsData, error } = await supabase
          .from("kol_campaigns")
          .select("*")
          .eq("organization_id", organizationId);
        if (error) throw error;
        campaigns = campaignsData || [];
      } catch (err) {
        // Campaigns may not exist in early builds; keep empty.
        if (!getExpectedColumnsFailure(err)) throw err;
        campaigns = [];
      }

      return { profiles, campaigns, socialAccounts };
    },
  });

  const processed = useMemo(() => {
    const rawProfiles = data?.profiles ?? [];
    const campaigns = data?.campaigns ?? [];
    const socialAccounts = data?.socialAccounts ?? [];

    const profilesWithStats: KOLProfileWithStats[] = rawProfiles.map((profile: any) => {
      const kolSocial = socialAccounts.filter(
        (acc: any) => acc.kol_profile_id === profile.id,
      );

      const totalFollowers = kolSocial.reduce(
        (sum: number, acc: any) => sum + (acc.followers || 0),
        0,
      );

      const avgEngagement =
        kolSocial.length > 0
          ? kolSocial.reduce(
              (sum: number, acc: any) => sum + (acc.engagement_rate || 0),
              0,
            ) / kolSocial.length
          : profile.engagement_rate || 0;

      // We don't rely on kol_campaign_assignments yet; keep it defensive.
      const activeCampaigns = 0;

      return {
        id: profile.id,
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        age: profile.age || 0,
        gender: profile.gender || "",
        category: profile.category || "",
        status: profile.status || "active",
        followers_count: profile.followers_count || 0,
        engagement_rate: profile.engagement_rate || avgEngagement,
        profile_photo_url: profile.profile_photo_url || "",
        active_campaigns: activeCampaigns,
        total_reach: totalFollowers || 0,
        social_accounts: kolSocial.map((acc: any) => ({
          platform: acc.platform || "",
          followers: acc.followers || 0,
          engagement_rate: acc.engagement_rate || 0,
        })),
        total_posts: profile.total_posts,
        niche: profile.niche,
        location: profile.location,
        specialties: profile.specialties,
      };
    });

    // Apply filters (same structure as reference).
    let filteredProfiles = profilesWithStats;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredProfiles = filteredProfiles.filter((profile) => {
        return (
          profile.name.toLowerCase().includes(searchLower) ||
          profile.email.toLowerCase().includes(searchLower) ||
          profile.category.toLowerCase().includes(searchLower)
        );
      });
    }

    if (filters.category && filters.category !== "all") {
      filteredProfiles = filteredProfiles.filter(
        (profile) => profile.category.toLowerCase() === filters.category.toLowerCase(),
      );
    }

    if (filters.platform && filters.platform !== "all") {
      filteredProfiles = filteredProfiles.filter((profile) =>
        profile.social_accounts.some(
          (acc) => acc.platform.toLowerCase() === filters.platform.toLowerCase(),
        ),
      );
    }

    if (filters.status && filters.status !== "all") {
      filteredProfiles = filteredProfiles.filter(
        (profile) => profile.status.toLowerCase() === filters.status.toLowerCase(),
      );
    }

    if (filters.performance && filters.performance !== "all") {
      const performanceThreshold: Record<string, number> = {
        high: 5,
        medium: 2,
        low: 0,
      };
      const threshold = performanceThreshold[filters.performance] ?? 0;
      filteredProfiles = filteredProfiles.filter((profile) => {
        const avgEng =
          profile.social_accounts.length > 0
            ? profile.social_accounts.reduce((sum, acc) => sum + (acc.engagement_rate || 0), 0) /
              profile.social_accounts.length
            : profile.engagement_rate || 0;

        if (filters.performance === "high") return avgEng >= threshold;
        if (filters.performance === "medium") return avgEng >= threshold && avgEng < 5;
        if (filters.performance === "low") return avgEng < 2;
        return true;
      });
    }

    const totalKOLs = profilesWithStats.length;
    const activeKOLs = profilesWithStats.filter((p) => p.status === "active").length;
    const totalFollowers = profilesWithStats.reduce((sum, p) => sum + p.total_reach, 0);
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter((c: any) => c.status === "active").length;

    const avgEngagement =
      profilesWithStats.length > 0
        ? profilesWithStats.reduce((sum, p) => {
            const engagement =
              p.social_accounts.length > 0
                ? p.social_accounts.reduce((acc, sa) => acc + (sa.engagement_rate || 0), 0) /
                  p.social_accounts.length
                : p.engagement_rate || 0;
            return sum + engagement;
          }, 0) / profilesWithStats.length
        : 0;

    const metrics: KOLMetrics = {
      totalKOLs,
      activeKOLs,
      totalFollowers,
      totalCampaigns,
      activeCampaigns,
      avgEngagement: Number(avgEngagement.toFixed(2)),
    };

    return { filteredProfiles, metrics };
  }, [data, filters]);

  return {
    filteredProfiles: processed.filteredProfiles,
    metrics: processed.metrics,
    isLoading,
    isPending,
  };
};

