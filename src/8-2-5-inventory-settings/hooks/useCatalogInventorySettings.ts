import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type {
  CatalogInventorySettings,
  CatalogInventorySettingsSave,
  InventoryFeatureAccessRow,
  InventoryFeatureKey,
  InventoryUserRole,
} from "../types";

export const CATALOG_INVENTORY_SETTINGS_QUERY_KEY = "catalog-inventory-settings";

function mapSettings(data: {
  organization_id: string;
  po_mode: string;
  transfer_mode: string;
  feature_access: Array<{ feature_key: string; allowed_roles: string[] }>;
}): CatalogInventorySettings {
  return {
    organization_id: data.organization_id,
    po_mode: data.po_mode === "advanced" ? "advanced" : "simple",
    transfer_mode: data.transfer_mode === "advanced" ? "advanced" : "simple",
    feature_access: (data.feature_access ?? []).map((row) => ({
      feature_key: row.feature_key as InventoryFeatureKey,
      allowed_roles: (row.allowed_roles ?? []) as InventoryUserRole[],
    })),
  };
}

async function fetchSettings(organizationId: string): Promise<CatalogInventorySettings> {
  const { data, error } = await supabase.rpc("get_or_create_catalog_inventory_settings", {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  return mapSettings(data as CatalogInventorySettings & { feature_access: InventoryFeatureAccessRow[] });
}

export function useCatalogInventorySettings() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_INVENTORY_SETTINGS_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogInventorySettings | null> => {
      if (!organizationId) return null;
      return fetchSettings(organizationId);
    },
    enabled: !!organizationId,
  });

  const save = useMutation({
    mutationFn: async (payload: CatalogInventorySettingsSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const { data, error } = await supabase.rpc("upsert_catalog_inventory_settings", {
        p_organization_id: organizationId,
        p_po_mode: payload.po_mode,
        p_transfer_mode: payload.transfer_mode,
        p_feature_access: payload.feature_access,
      });
      if (error) throw error;
      return mapSettings(data as CatalogInventorySettings & { feature_access: InventoryFeatureAccessRow[] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [CATALOG_INVENTORY_SETTINGS_QUERY_KEY, organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["catalog-inventory-workflow-modes", organizationId],
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
