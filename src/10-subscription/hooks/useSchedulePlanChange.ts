import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";

function uuidOrNull(value: string | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

export type AddonSelectionSnapshot = Record<string, { included: boolean; quantity: number }>;

export interface SchedulePlanChangeParams {
  current_plan_id: string;
  target_plan_id: string;
  current_member_count: number;
  target_member_count: number;
  change_type:
    | "upgrade"
    | "downgrade"
    | "member_increase"
    | "member_decrease"
    | "mixed"
    | "addon_decrease"
    | "addon_disable";
  scheduled_date: string;
  prorate_amount?: number;
  charge_now?: boolean;
  target_billing_cycle?: string | null;
  target_billing_term_months?: number | null;
  target_addon_selections?: AddonSelectionSnapshot;
  current_addon_snapshot?: AddonSelectionSnapshot;
}

export function useSchedulePlanChange() {
  const { t } = useTranslation();
  const { organizationId } = useActiveOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SchedulePlanChangeParams) => {
      if (!organizationId) throw new Error("No organization ID");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const scheduled =
        params.scheduled_date != null && String(params.scheduled_date).trim() !== ""
          ? String(params.scheduled_date).trim()
          : new Date().toISOString();

      const { data: existingPending } = await supabase
        .from("subscription_change_requests")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .limit(1);

      if (existingPending?.length) {
        const { error: cancelErr } = await supabase
          .from("subscription_change_requests")
          .update({ status: "cancelled" })
          .eq("organization_id", organizationId)
          .eq("status", "pending");
        if (cancelErr) throw cancelErr;
      }

      const { error } = await supabase.from("subscription_change_requests").insert({
        organization_id: organizationId,
        current_plan_id: uuidOrNull(params.current_plan_id),
        target_plan_id: uuidOrNull(params.target_plan_id),
        current_member_count: params.current_member_count,
        target_member_count: params.target_member_count,
        change_type: params.change_type,
        scheduled_date: scheduled,
        prorate_amount: params.prorate_amount ?? 0,
        charge_now: params.charge_now ?? false,
        target_billing_cycle: params.target_billing_cycle ?? null,
        target_billing_term_months: params.target_billing_term_months ?? null,
        target_addon_selections: params.target_addon_selections ?? {},
        current_addon_snapshot: params.current_addon_snapshot ?? {},
        requested_by: user.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["subscription-change-requests", organizationId] });
      }
      toast.success(t("subscription.plans.toast.scheduleSuccess"));
    },
    onError: (err: Error) => toast.error(err.message || t("subscription.plans.toast.scheduleFailed")),
  });
}
