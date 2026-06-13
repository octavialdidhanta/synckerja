import { useQuery } from "@tanstack/react-query";
import { fetchPlatformMappings } from "@/stock-management/lib/inventoryApi";

export function usePlatformSkuMappingsQuery(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["inventory-mappings", organizationId],
    queryFn: () => fetchPlatformMappings(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });
}
