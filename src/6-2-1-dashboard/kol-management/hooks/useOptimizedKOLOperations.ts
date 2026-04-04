import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useToast } from "@/shared/components/ui/use-toast";
import { supabase } from "@/shared/lib/supabaseClient";

export const useOptimizedKOLOperations = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: kolData, isLoading: kolLoading } = useQuery({
    queryKey: ["kol-profiles-with-social", organizationId],
    queryFn: async () => {
      return { profiles: [], socialAccounts: [] };
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["kol-campaigns-optimized", organizationId],
    queryFn: async () => {
      return [];
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const bulkUpdateProfiles = useMutation({
    mutationFn: async (_updates: { ids: string[]; data: any }) => {
      // no-op placeholder
    },
    onError: () => {
      toast({
        title: "Operation failed",
        description: "Unable to update KOL profiles.",
        variant: "destructive",
      });
    },
  });

  const updateKOLProfile = useMutation({
    mutationFn: async (_args: { id: string; data: any }) => {
      // no-op placeholder
    },
  });

  const deleteKOLProfile = useMutation({
    mutationFn: async (_id: string) => {
      // no-op placeholder
    },
  });

  const updateSocialAccount = useMutation({
    mutationFn: async (_args: { id: string; data: any }) => {
      // no-op placeholder
    },
  });

  const createSocialAccount = useMutation({
    mutationFn: async (_data: any) => {
      return null as any;
    },
  });

  const deleteSocialAccount = useMutation({
    mutationFn: async (_id: string) => {
      // no-op placeholder
    },
  });

  const assignKOLToCampaign = useMutation({
    mutationFn: async ({
      campaignId,
      kolProfileId,
    }: {
      campaignId: string;
      kolProfileId: string;
    }) => {
      const { data: existing, error: selectError } = await supabase
        .from("kol_campaign_assignments")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("kol_profile_id", kolProfileId)
        .maybeSingle();

      if (selectError) throw selectError;
      if (existing?.id) return { id: existing.id };

      const { data, error } = await supabase
        .from("kol_campaign_assignments")
        .insert({ campaign_id: campaignId, kol_profile_id: kolProfileId })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["kol-campaign-assignments"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : String((err as { message?: string })?.message || err);
      toast({
        title: "Tidak dapat menugaskan KOL",
        description: message,
        variant: "destructive",
      });
    },
  });

  const calculateMetrics = () => {
    if (!kolData) return null;
    const { profiles, socialAccounts } = kolData as any;
    const totalFollowers = (socialAccounts || []).reduce(
      (sum: number, account: any) => sum + (account.followers || 0),
      0,
    );
    const avgEngagement =
      (socialAccounts || []).length > 0
        ? (socialAccounts || []).reduce(
            (sum: number, account: any) => sum + (account.engagement_rate || 0),
            0,
          ) / (socialAccounts || []).length
        : 0;

    return {
      totalKOLs: (profiles || []).length,
      activeKOLs: (profiles || []).filter((p: any) => p.status === "active").length,
      totalFollowers,
      avgEngagement: avgEngagement.toFixed(2),
      totalCampaigns: Array.isArray(campaigns) ? campaigns.length : 0,
      activeCampaigns: Array.isArray(campaigns)
        ? campaigns.filter((c: any) => c.status === "active").length
        : 0,
    };
  };

  return {
    profiles: Array.isArray((kolData as any)?.profiles) ? (kolData as any).profiles : [],
    socialAccounts: Array.isArray((kolData as any)?.socialAccounts)
      ? (kolData as any).socialAccounts
      : [],
    campaigns: Array.isArray(campaigns) ? campaigns : [],
    metrics: calculateMetrics(),
    isLoading: kolLoading || campaignsLoading,
    bulkUpdateProfiles,
    assignKOLToCampaign,
    updateKOLProfile: (id: string, data: any) =>
      updateKOLProfile.mutateAsync({ id, data }),
    deleteKOLProfile: (id: string) => deleteKOLProfile.mutateAsync(id),
    updateSocialAccount: (id: string, data: any) =>
      updateSocialAccount.mutateAsync({ id, data }),
    createSocialAccount: (data: any) => createSocialAccount.mutateAsync(data),
    deleteSocialAccount: (id: string) => deleteSocialAccount.mutateAsync(id),
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-profiles-with-social"] });
      queryClient.invalidateQueries({ queryKey: ["kol-campaigns-optimized"] });
    },
  };
};

