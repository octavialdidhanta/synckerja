import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  DEFAULT_POS_OUTLET_SHIFT_SETTINGS,
  type PosOutletShiftSettings,
} from "./posShiftTypes";

export const POS_OUTLET_SHIFT_SETTINGS_QUERY_KEY = "pos-outlet-shift-settings";

export function usePosOutletShiftSettings(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [POS_OUTLET_SHIFT_SETTINGS_QUERY_KEY, organizationId, outletId],
    queryFn: async (): Promise<PosOutletShiftSettings> => {
      if (!organizationId || !outletId) {
        return {
          outlet_id: outletId ?? "",
          organization_id: organizationId ?? "",
          ...DEFAULT_POS_OUTLET_SHIFT_SETTINGS,
        };
      }
      const { data, error } = await supabase
        .from("pos_outlet_shift_settings")
        .select(
          "outlet_id, organization_id, auto_start_enabled, default_opening_cash, created_at, updated_at",
        )
        .eq("outlet_id", outletId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          outlet_id: outletId,
          organization_id: organizationId,
          ...DEFAULT_POS_OUTLET_SHIFT_SETTINGS,
        };
      }
      return {
        outlet_id: data.outlet_id as string,
        organization_id: data.organization_id as string,
        auto_start_enabled: Boolean(data.auto_start_enabled),
        default_opening_cash: Number(data.default_opening_cash ?? 100_000),
        created_at: data.created_at as string | undefined,
        updated_at: data.updated_at as string | undefined,
      };
    },
    enabled: Boolean(organizationId && outletId),
  });

  const save = useMutation({
    mutationFn: async (payload: {
      auto_start_enabled: boolean;
      default_opening_cash: number;
    }) => {
      if (!organizationId || !outletId) throw new Error("Organization ID is required");
      const row = {
        outlet_id: outletId,
        organization_id: organizationId,
        auto_start_enabled: Boolean(payload.auto_start_enabled),
        default_opening_cash: Math.max(0, Number(payload.default_opening_cash) || 0),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("pos_outlet_shift_settings")
        .upsert(row, { onConflict: "outlet_id", ignoreDuplicates: false });
      if (error) throw error;
      return row;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [POS_OUTLET_SHIFT_SETTINGS_QUERY_KEY, organizationId, outletId],
      });
    },
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    save: save.mutateAsync,
    isSaving: save.isPending,
  };
}
