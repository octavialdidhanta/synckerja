import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { normalizeIndonesiaBankName } from "../lib/indonesiaBanks";
import {
  buildBankAccountDisplayName,
  mapBankNameToGatewayCode,
} from "../lib/mapBankNameToGatewayCode";

export type OpsBankAccount = {
  id: string;
  name: string;
  account_number: string | null;
  bank_name: string | null;
  account_holder: string | null;
  organization_id: string;
  is_active: boolean;
  gateway_payout_bank_code: string | null;
  created_at: string;
  updated_at: string;
};

export type OpsBankAccountFormValues = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

async function logActivity(args: {
  organizationId: string;
  bankAccountId: string | null;
  action: string;
  summary: string;
  meta?: Record<string, unknown>;
}) {
  await supabase.rpc("log_bank_account_activity", {
    p_organization_id: args.organizationId,
    p_bank_account_id: args.bankAccountId,
    p_action: args.action,
    p_summary: args.summary,
    p_meta: args.meta ?? {},
  });
}

export function useOpsBankAccounts() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useAppTranslation();

  const query = useQuery({
    queryKey: ["ops-bank-accounts", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<OpsBankAccount[]> => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select(
          "id, name, account_number, bank_name, account_holder, organization_id, is_active, gateway_payout_bank_code, created_at, updated_at",
        )
        .eq("organization_id", organizationId!)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OpsBankAccount[];
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["ops-bank-accounts", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["bank-accounts", organizationId] });
    void queryClient.invalidateQueries({
      queryKey: ["bank-account-activity", organizationId],
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (args: {
      id?: string | null;
      values: OpsBankAccountFormValues;
    }) => {
      if (!organizationId) throw new Error("Organization required");
      const bankName =
        normalizeIndonesiaBankName(args.values.bankName) ||
        args.values.bankName.trim();
      const accountNumber = args.values.accountNumber.trim();
      const accountHolder = args.values.accountHolder.trim();
      if (!bankName || !accountNumber || !accountHolder) {
        throw new Error("missing_fields");
      }
      const name = buildBankAccountDisplayName({
        bankName,
        accountNumber,
        accountHolder,
      });
      const gatewayCode = mapBankNameToGatewayCode(bankName);
      const { data: userData } = await supabase.auth.getUser();

      if (args.id) {
        const { data, error } = await supabase
          .from("bank_accounts")
          .update({
            name,
            bank_name: bankName,
            account_number: accountNumber,
            account_holder: accountHolder,
            gateway_payout_bank_code: gatewayCode,
          })
          .eq("id", args.id)
          .eq("organization_id", organizationId)
          .select(
            "id, name, account_number, bank_name, account_holder, organization_id, is_active, gateway_payout_bank_code, created_at, updated_at",
          )
          .single();
        if (error) throw error;
        await logActivity({
          organizationId,
          bankAccountId: data.id,
          action: "update",
          summary: `Updated ${name}`,
          meta: { bankName, accountNumber },
        });
        return data as OpsBankAccount;
      }

      const { data, error } = await supabase
        .from("bank_accounts")
        .insert({
          organization_id: organizationId,
          name,
          bank_name: bankName,
          account_number: accountNumber,
          account_holder: accountHolder,
          gateway_payout_bank_code: gatewayCode,
          is_active: true,
          created_by: userData.user?.id ?? null,
        })
        .select(
          "id, name, account_number, bank_name, account_holder, organization_id, is_active, gateway_payout_bank_code, created_at, updated_at",
        )
        .single();
      if (error) throw error;
      await logActivity({
        organizationId,
        bankAccountId: data.id,
        action: "create",
        summary: `Added ${name}`,
        meta: { bankName, accountNumber },
      });
      return data as OpsBankAccount;
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: t("settings.bankAccount.saved", "Bank account saved"),
      });
    },
    onError: (err) => {
      toast({
        title: t("settings.bankAccount.saveError", "Failed to save bank account"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) throw new Error("Organization required");
      const { data, error } = await supabase
        .from("bank_accounts")
        .update({ is_active: false })
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select("id, name")
        .single();
      if (error) throw error;
      await logActivity({
        organizationId,
        bankAccountId: id,
        action: "deactivate",
        summary: `Deactivated ${data.name}`,
      });
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: t("settings.bankAccount.deactivated", "Bank account deactivated"),
      });
    },
  });

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    deactivate: deactivateMutation.mutateAsync,
    isDeactivating: deactivateMutation.isPending,
  };
}
