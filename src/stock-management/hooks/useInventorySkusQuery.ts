import { useQuery } from "@tanstack/react-query";
import { fetchInventorySkus } from "@/stock-management/lib/inventoryApi";

export function useInventorySkusQuery(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["inventory-skus", organizationId],
    queryFn: () => fetchInventorySkus(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });
}
