import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { InventoryWorkflowMode } from "@/8-2-5-inventory-settings/types";

export const CATALOG_INVENTORY_WORKFLOW_MODES_QUERY_KEY = "catalog-inventory-workflow-modes";

export type CatalogInventoryWorkflowModes = {
  po_mode: InventoryWorkflowMode;
  transfer_mode: InventoryWorkflowMode;
};

async function fetchWorkflowModes(organizationId: string): Promise<CatalogInventoryWorkflowModes> {
  const { data, error } = await supabase.rpc("get_catalog_inventory_workflow_modes", {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  const row = (data ?? {}) as { po_mode?: string; transfer_mode?: string };
  return {
    po_mode: row.po_mode === "advanced" ? "advanced" : "simple",
    transfer_mode: row.transfer_mode === "advanced" ? "advanced" : "simple",
  };
}

export function useCatalogInventoryWorkflowModes() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [CATALOG_INVENTORY_WORKFLOW_MODES_QUERY_KEY, organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) {
        return { po_mode: "simple" as const, transfer_mode: "simple" as const };
      }
      return fetchWorkflowModes(organizationId);
    },
    staleTime: 60_000,
  });
}

export function usePoWorkflowMode() {
  const query = useCatalogInventoryWorkflowModes();
  return {
    poMode: query.data?.po_mode ?? "simple",
    isLoading: query.isLoading,
  };
}

export function useTransferWorkflowMode() {
  const query = useCatalogInventoryWorkflowModes();
  return {
    transferMode: query.data?.transfer_mode ?? "simple",
    isLoading: query.isLoading,
  };
}
