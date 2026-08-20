import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { InventorySkuRow } from "@/stock-management/types/inventory";
import { useInventorySkusQuery } from "./useInventorySkusQuery";

export function useOrphanInventorySkus(organizationId: string | null | undefined) {
  const skusQuery = useInventorySkusQuery(organizationId);
  const linkedQuery = useQuery({
    queryKey: ["inventory-sku-linked", organizationId],
    queryFn: async (): Promise<Set<string>> => {
      if (!organizationId) return new Set();
      const { data, error } = await supabase
        .from("default_prices")
        .select("inventory_sku_id")
        .eq("organization_id", organizationId)
        .not("inventory_sku_id", "is", null);
      if (error) throw error;
      return new Set(
        (data ?? [])
          .map((row) => row.inventory_sku_id)
          .filter((id): id is string => Boolean(id)),
      );
    },
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });

  const orphans = useMemo((): InventorySkuRow[] => {
    const linked = linkedQuery.data ?? new Set<string>();
    return (skusQuery.data?.rows ?? []).filter((row) => row.is_active && !linked.has(row.id));
  }, [linkedQuery.data, skusQuery.data?.rows]);

  return {
    orphans,
    orphanCount: orphans.length,
    isLoading: skusQuery.isLoading || linkedQuery.isLoading,
  };
}
