import { useQuery } from "@tanstack/react-query";
import { fetchInventorySyncLogs } from "@/stock-management/lib/inventoryApi";

export function useInventorySyncLogsQuery(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["inventory-sync-logs", organizationId],
    queryFn: () => fetchInventorySyncLogs(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 15_000,
  });
}
