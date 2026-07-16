import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";

export type PendingSubscriptionChangeRow = {
  id: string;
  organization_id: string;
  current_plan_id: string | null;
  target_plan_id: string | null;
  current_member_count: number;
  target_member_count: number;
  change_type: string;
  scheduled_date: string;
  target_billing_cycle: string | null;
  target_addon_selections: Record<string, { included: boolean; quantity: number }>;
  current_addon_snapshot: Record<string, { included: boolean; quantity: number }>;
  status: string;
  created_at: string;
};

export function usePendingSubscriptionChanges() {
  const { organizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: ["subscription-change-requests", organizationId],
    queryFn: async (): Promise<PendingSubscriptionChangeRow | null> => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("subscription_change_requests")
        .select(
          "id, organization_id, current_plan_id, target_plan_id, current_member_count, target_member_count, change_type, scheduled_date, target_billing_cycle, target_addon_selections, current_addon_snapshot, status, created_at",
        )
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as PendingSubscriptionChangeRow | null) ?? null;
    },
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });

  const cancelPending = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("subscription_change_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["subscription-change-requests", organizationId] });
      }
      toast.success(t("subscription.plans.pendingChanges.cancelSuccess"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("subscription.plans.pendingChanges.cancelFailed"));
    },
  });

  const applyDue = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("apply_due_subscription_change_requests");
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (applied) => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["subscription-change-requests", organizationId] });
        queryClient.invalidateQueries({ queryKey: ["subscription-status", organizationId] });
      }
      if (applied > 0) {
        toast.success(t("subscription.plans.pendingChanges.applied", { count: applied }));
      }
    },
  });

  return { ...query, cancelPending, applyDue };
}
