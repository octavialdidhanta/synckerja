import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { defaultWeeklyHours, normalizeWeeklyHours, type WeeklyHourRule } from "@/synckerja-order/shared/lib/orderHours";

export const SYNCKERJA_ORDER_HOURS_QUERY = "synckerja-order-hours";

export type SynckerjaOrderHoursRow = {
  outlet_id: string;
  organization_id: string;
  force_closed: boolean;
  timezone: string;
  weekly_hours: WeeklyHourRule[];
};

export function useSynckerjaOrderHours(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [SYNCKERJA_ORDER_HOURS_QUERY, organizationId, outletId],
    queryFn: async (): Promise<SynckerjaOrderHoursRow | null> => {
      if (!organizationId || !outletId) return null;
      const { data, error } = await supabase
        .from("synckerja_order_outlet_settings")
        .select("outlet_id, organization_id, force_closed, timezone, weekly_hours")
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          outlet_id: outletId,
          organization_id: organizationId,
          force_closed: false,
          timezone: "Asia/Jakarta",
          weekly_hours: defaultWeeklyHours(),
        };
      }
      return {
        outlet_id: String(data.outlet_id),
        organization_id: String(data.organization_id),
        force_closed: Boolean(data.force_closed),
        timezone: String(data.timezone || "Asia/Jakarta"),
        weekly_hours: normalizeWeeklyHours(data.weekly_hours),
      };
    },
    enabled: Boolean(organizationId && outletId),
  });

  const save = useMutation({
    mutationFn: async (args: { forceClosed: boolean; weeklyHours: WeeklyHourRule[] }) => {
      if (!organizationId || !outletId) throw new Error("Organization ID is required");
      const { error } = await supabase.from("synckerja_order_outlet_settings").upsert(
        {
          organization_id: organizationId,
          outlet_id: outletId,
          enabled: true,
          force_closed: args.forceClosed,
          timezone: "Asia/Jakarta",
          weekly_hours: normalizeWeeklyHours(args.weeklyHours),
        },
        { onConflict: "outlet_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [SYNCKERJA_ORDER_HOURS_QUERY, organizationId, outletId],
      });
    },
  });

  return { ...query, row: query.data ?? null, save };
}
