import { useQuery } from "@tanstack/react-query";
import { fetchPublicOrderItemOptions } from "@/synckerja-order/shared/lib/tenantResolve";

export function usePublicOrderItemOptions(args: {
  code: string;
  itemId: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["public-order-item-options", args.code, args.itemId],
    queryFn: () => fetchPublicOrderItemOptions({ code: args.code, itemId: args.itemId as string }),
    enabled: Boolean(args.code && args.itemId && args.enabled !== false),
    staleTime: 15_000,
  });
}
