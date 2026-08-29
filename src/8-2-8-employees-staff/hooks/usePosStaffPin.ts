import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { POS_EMPLOYEE_STAFF_QUERY_KEY } from "./usePosEmployeeStaff";
import type { PosPinAccessSettings } from "../lib/posStaffTypes";

export const POS_PIN_ACCESS_SETTINGS_QUERY_KEY = "pos-pin-access-settings";

const DEFAULT_SETTINGS = (
  organizationId: string,
): PosPinAccessSettings => ({
  organization_id: organizationId,
  require_pin_for_void: false,
  require_pin_for_refund: false,
  require_pin_for_discount: false,
  require_pin_for_cash_drawer: true,
  required_features: ["pin.feature.cash_drawer"],
});

export function usePosStaffPin() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
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
      if (!data) return DEFAULT_SETTINGS(organizationId);
      const row = data as PosPinAccessSettings;
      return {
        ...DEFAULT_SETTINGS(organizationId),
        ...row,
        required_features: Array.isArray(row.required_features)
          ? row.required_features
          : DEFAULT_SETTINGS(organizationId).required_features,
      };
    },
  });

  const invalidateStaff = () => {
    void queryClient.invalidateQueries({ queryKey: [POS_EMPLOYEE_STAFF_QUERY_KEY, organizationId] });
  };

  const setPin = useMutation({
    mutationFn: async ({ staffId, pin }: { staffId: string; pin: string }) => {
      const { error } = await supabase.rpc("pos_staff_set_pin", {
        p_staff_id: staffId,
        p_pin: pin,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateStaff(),
  });

  const clearPin = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase.rpc("pos_staff_clear_pin", {
        p_staff_id: staffId,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateStaff(),
  });

  const updateAllowPin = useMutation({
    mutationFn: async ({
      staffId,
      allow_pin_for_permissions,
    }: {
      staffId: string;
      allow_pin_for_permissions: boolean;
    }) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const { error } = await supabase
        .from("pos_employee_staff")
        .update({ allow_pin_for_permissions })
        .eq("id", staffId)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: () => invalidateStaff(),
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: Partial<Omit<PosPinAccessSettings, "organization_id">>) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const current = settingsQuery.data ?? DEFAULT_SETTINGS(organizationId);
      const next = { ...current, ...patch, organization_id: organizationId };
      const { error } = await supabase.from("pos_pin_access_settings").upsert(next, {
        onConflict: "organization_id",
      });
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [POS_PIN_ACCESS_SETTINGS_QUERY_KEY, organizationId],
      });
    },
  });

  return {
    settings: settingsQuery.data ?? (organizationId ? DEFAULT_SETTINGS(organizationId) : null),
    settingsLoading: settingsQuery.isLoading,
    settingsError: settingsQuery.error,
    setPin,
    clearPin,
    updateAllowPin,
    saveSettings,
  };
}
