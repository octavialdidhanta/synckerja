import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { InventoryOrgRoleRow, InventoryUserRole } from "../types";

export const INVENTORY_ORG_ROLES_QUERY_KEY = "catalog-inventory-org-roles";

export function useInventoryOrgRoles(enabled = true) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [INVENTORY_ORG_ROLES_QUERY_KEY, organizationId],
    enabled: Boolean(organizationId && enabled),
    queryFn: async (): Promise<InventoryOrgRoleRow[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase.rpc("list_catalog_inventory_org_roles", {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      return (data ?? []).map((row: { role: string; employee_count: number | string }) => ({
        role: row.role as InventoryUserRole,
        employee_count: Number(row.employee_count) || 0,
      }));
    },
  });
}

export function useInventoryFeatureAccessCheck(featureKey: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ["inventory-feature-access", organizationId, featureKey],
    enabled: Boolean(organizationId && featureKey),
    queryFn: async (): Promise<boolean> => {
      if (!organizationId || !featureKey) return false;
      const { data, error } = await supabase.rpc("user_has_inventory_feature_access", {
        p_organization_id: organizationId,
        p_feature_key: featureKey,
      });
      if (error) throw error;
      return Boolean(data);
    },
    staleTime: 30_000,
  });
}
