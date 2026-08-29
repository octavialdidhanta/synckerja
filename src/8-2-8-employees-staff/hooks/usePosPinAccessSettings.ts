import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { legacyFlagsFromFeatures } from "../lib/pinFeatureCatalog";
import type { PosPinAccessSettings } from "../lib/posStaffTypes";

export const POS_PIN_ACCESS_SETTINGS_QUERY_KEY = "pos-pin-access-settings";

export function defaultPosPinAccessSettings(organizationId: string): PosPinAccessSettings {
  return {
    organization_id: organizationId,
    require_pin_for_void: false,
    require_pin_for_refund: false,
    require_pin_for_discount: false,
    require_pin_for_cash_drawer: true,
    required_features: ["pin.feature.cash_drawer"],
  };
}

function normalizeSettings(
  organizationId: string,
  row: Partial<PosPinAccessSettings> | null,
): PosPinAccessSettings {
  const base = defaultPosPinAccessSettings(organizationId);
  if (!row) return base;
  return {
    organization_id: organizationId,
    require_pin_for_void: Boolean(row.require_pin_for_void),
    require_pin_for_refund: Boolean(row.require_pin_for_refund),
    require_pin_for_discount: Boolean(row.require_pin_for_discount),
    require_pin_for_cash_drawer: Boolean(row.require_pin_for_cash_drawer ?? true),
    required_features: Array.isArray(row.required_features)
      ? [...row.required_features]
      : base.required_features,
  };
}

export function usePosPinAccessSettings() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [POS_PIN_ACCESS_SETTINGS_QUERY_KEY, organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<PosPinAccessSettings> => {
      if (!organizationId) throw new Error("Organization ID is required");
      const { data, error } = await supabase
        .from("pos_pin_access_settings")
        .select(
          "organization_id, require_pin_for_void, require_pin_for_refund, require_pin_for_discount, require_pin_for_cash_drawer, required_features",
        )
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return normalizeSettings(organizationId, data as PosPinAccessSettings | null);
    },
  });

  const save = useMutation({
    mutationFn: async (required_features: string[]) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const legacy = legacyFlagsFromFeatures(required_features);
      const next: PosPinAccessSettings = {
        organization_id: organizationId,
        required_features: [...new Set(required_features)],
        ...legacy,
      };
      const { error } = await supabase.from("pos_pin_access_settings").upsert(next, {
        onConflict: "organization_id",
      });
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData([POS_PIN_ACCESS_SETTINGS_QUERY_KEY, organizationId], next);
      void queryClient.invalidateQueries({
        queryKey: [POS_PIN_ACCESS_SETTINGS_QUERY_KEY, organizationId],
      });
    },
  });

  return {
    settings: query.data ?? (organizationId ? defaultPosPinAccessSettings(organizationId) : null),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    save,
  };
}
