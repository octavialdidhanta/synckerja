import { useQuery } from "@tanstack/react-query";
import { fetchInventoryMovements } from "@/stock-management/lib/inventoryApi";

export function useInventoryMovementsQuery(
  organizationId: string | null | undefined,
  skuId?: string | null,
) {
  return useQuery({
    queryKey: ["inventory-movements", organizationId, skuId ?? "all"],
    queryFn: () => fetchInventoryMovements(organizationId!, skuId ?? undefined),
    enabled: Boolean(organizationId),
    staleTime: 15_000,
  });
}
