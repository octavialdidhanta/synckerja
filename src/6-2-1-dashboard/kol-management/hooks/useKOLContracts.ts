import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useToast } from "@/shared/components/ui/use-toast";

export type KOLContract = {
  id: string;
  campaign_id: string;
  kol_profile_id: string;
  organization_id: string;
  contract_number: string;
  contract_terms: Record<string, unknown>;
  kpi_metrics: Record<string, unknown>;
  content_requirements: Record<string, unknown> | null;
  posting_schedule: Record<string, unknown> | null;
  deliverables: Record<string, unknown> | null;
  penalties: Record<string, unknown> | null;
  status: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  created_at: string;
  updated_at: string;
  kol_profile?: { id: string; name: string | null } | null;
};

export type CreateKOLContractInput = {
  campaign_id: string;
  kol_profile_id: string;
  contract_terms?: Record<string, unknown>;
  kpi_metrics?: Record<string, unknown>;
  content_requirements?: Record<string, unknown>;
  deliverables?: Record<string, unknown>;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  status?: string;
};

export const useKOLContracts = (campaignId?: string | null) => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: contracts = [], isLoading, isPending } = useQuery({
    queryKey: ["kol-contracts", organizationId, campaignId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<KOLContract[]> => {
      if (!organizationId) return [];

      let query = supabase
        .from("kol_contracts")
        .select("*, kol_profile:kol_profiles(id, name)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;
      if (error) {
        const msg = error.message || "";
        if (error.code === "42P01" || msg.includes("does not exist")) return [];
        throw error;
      }
      return (data || []) as KOLContract[];
    },
  });

  const createContract = useMutation({
    mutationFn: async (input: CreateKOLContractInput) => {
      if (!organizationId) throw new Error("Organization is required");

      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("kol_contracts")
        .insert({
          ...input,
          organization_id: organizationId,
          contract_terms: input.contract_terms ?? {},
          kpi_metrics: input.kpi_metrics ?? {},
          content_requirements: input.content_requirements ?? {},
          deliverables: input.deliverables ?? {},
          status: input.status ?? "draft",
          created_by: userData.user?.id ?? null,
        })
        .select("*, kol_profile:kol_profiles(id, name)")
        .single();

      if (error) throw error;
      return data as KOLContract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-contracts"] });
      toast({ title: "Success", description: "Contract created successfully." });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contract.",
        variant: "destructive",
      });
    },
  });

  const updateContractStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("kol_contracts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-contracts"] });
      toast({ title: "Success", description: "Contract status updated." });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contract.",
        variant: "destructive",
      });
    },
  });

  return {
    contracts,
    isLoading,
    isPending,
    createContract: createContract.mutateAsync,
    updateContractStatus: updateContractStatus.mutateAsync,
  };
};
