import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type BankAccountOutletRow = {
  bank_account_id: string;
  outlet_id: string;
  organization_id: string;
};

export function useBankAccountOutlets(bankAccountId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useAppTranslation();

  const query = useQuery({
    queryKey: ["bank-account-outlets", organizationId, bankAccountId],
    enabled: Boolean(organizationId && bankAccountId),
    queryFn: async (): Promise<BankAccountOutletRow[]> => {
      const { data, error } = await supabase
        .from("bank_account_outlets")
        .select("bank_account_id, outlet_id, organization_id")
        .eq("organization_id", organizationId!)
        .eq("bank_account_id", bankAccountId!);
      if (error) throw error;
      return (data ?? []) as BankAccountOutletRow[];
    },
  });

  /** All outlet assignments for org (to show Unassigned / Assigned-to-other). */
  const allQuery = useQuery({
    queryKey: ["bank-account-outlets-all", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<BankAccountOutletRow[]> => {
      const { data, error } = await supabase
        .from("bank_account_outlets")
        .select("bank_account_id, outlet_id, organization_id")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      return (data ?? []) as BankAccountOutletRow[];
    },
  });

  const outletIds = useMemo(
    () => (query.data ?? []).map((r) => r.outlet_id),
    [query.data],
  );

  const saveMutation = useMutation({
    mutationFn: async (args: { bankAccountId: string; outletIds: string[] }) => {
      if (!organizationId) throw new Error("Organization required");

      // Soft uniqueness: an outlet can only map to one settlement account
      if (args.outletIds.length > 0) {
        const { error: clearOtherErr } = await supabase
          .from("bank_account_outlets")
          .delete()
          .eq("organization_id", organizationId)
          .in("outlet_id", args.outletIds)
          .neq("bank_account_id", args.bankAccountId);
        if (clearOtherErr) throw clearOtherErr;
      }

      const { error: delErr } = await supabase
        .from("bank_account_outlets")
        .delete()
        .eq("organization_id", organizationId)
        .eq("bank_account_id", args.bankAccountId);
      if (delErr) throw delErr;

      if (args.outletIds.length > 0) {
        const rows = args.outletIds.map((outletId) => ({
          bank_account_id: args.bankAccountId,
          outlet_id: outletId,
          organization_id: organizationId,
        }));
        const { error: insErr } = await supabase
          .from("bank_account_outlets")
          .insert(rows);
        if (insErr) throw insErr;
      }

      await supabase.rpc("log_bank_account_activity", {
        p_organization_id: organizationId,
        p_bank_account_id: args.bankAccountId,
        p_action: "assign_outlets",
        p_summary: `Assigned ${args.outletIds.length} outlet(s)`,
        p_meta: { outletIds: args.outletIds },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["bank-account-outlets", organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["bank-account-outlets-all", organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["bank-account-activity", organizationId],
      });
      toast({
        title: t("settings.bankAccount.outletsSaved", "Outlets updated"),
      });
    },
    onError: (err) => {
      toast({
        title: t("settings.bankAccount.outletsSaveError", "Failed to assign outlets"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    },
  });

  return {
    outletIds,
    allAssignments: allQuery.data ?? [],
    isLoading: Boolean(bankAccountId)
      ? query.isLoading || allQuery.isLoading
      : allQuery.isLoading,
    isError: query.isError || allQuery.isError,
    saveOutlets: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
