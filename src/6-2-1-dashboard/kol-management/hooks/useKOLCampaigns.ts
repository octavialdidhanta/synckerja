import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useToast } from "@/shared/components/ui/use-toast";

export type KOLCampaignAssignmentRow = {
  id: string;
  kol_profile_id: string;
};

export type KOLCampaign = {
  id: string;
  name: string;
  description?: string | null;
  budget?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  status: "draft" | "active" | "completed" | "cancelled" | string;
  objectives?: string | null;
  target_reach?: number | null;
  target_engagement?: number | null;
  target_conversion?: number | null;
  total_budget?: number | null;
  allocated_budget?: number | null;
  remaining_budget?: number | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  creator_name?: string;
  /** Populated when campaigns are fetched with nested `kol_campaign_assignments` */
  kol_campaign_assignments?: KOLCampaignAssignmentRow[];
};

const isMissingRelationOrColumn = (err: unknown) => {
  const message = String((err as any)?.message || "");
  const code = String((err as any)?.code || "");
  return code === "42703" || message.includes("does not exist") || message.includes("relation");
};

export const useKOLCampaigns = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: campaigns = [],
    isLoading,
    isPending,
    error,
  } = useQuery({
    queryKey: ["kol-campaigns", organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async (): Promise<KOLCampaign[]> => {
      if (!organizationId) return [];

      try {
        const { data, error } = await supabase
          .from("kol_campaigns")
          .select(
            `
            *,
            kol_campaign_assignments ( id, kol_profile_id )
          `,
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        return (data || []) as KOLCampaign[];
      } catch (err) {
        if (!isMissingRelationOrColumn(err)) {
          throw err;
        }
        // If kol_campaigns table is not ready yet, keep campaigns empty but UI should still render.
        return [];
      }
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (
      campaignData: Omit<
        KOLCampaign,
        "id" | "created_at" | "updated_at" | "organization_id" | "creator_name"
      >,
    ) => {
      if (!organizationId) {
        throw new Error(
          "No organization selected. Please ensure you are logged in and have an active organization.",
        );
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(
          "User not authenticated. Please log in to create campaigns.",
        );
      }

      if (!campaignData.name?.trim()) {
        throw new Error("Campaign name is required");
      }

      const insertData = {
        ...campaignData,
        organization_id: organizationId,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from("kol_campaigns")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        if (error.code === "42501") {
          throw new Error(
            "Access denied. Please check your organization membership and permissions.",
          );
        }
        if (error.code === "23505") {
          throw new Error(
            "A campaign with this name already exists in your organization.",
          );
        }
        throw new Error(`Failed to create campaign: ${error.message}`);
      }

      return data as KOLCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-campaigns"] });
      toast({
        title: "Success",
        description: "Campaign created successfully",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to create campaign",
        variant: "destructive",
      });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<KOLCampaign> & { id: string }) => {
      const { data, error } = await supabase
        .from("kol_campaigns")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as KOLCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-campaigns"] });
      toast({
        title: "Success",
        description: "Campaign updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update campaign",
        variant: "destructive",
      });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("kol_campaigns")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-campaigns"] });
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete campaign",
        variant: "destructive",
      });
    },
  });

  return {
    campaigns,
    isLoading,
    isPending,
    error,
    createCampaign,
    updateCampaign,
    deleteCampaign,
  };
};

