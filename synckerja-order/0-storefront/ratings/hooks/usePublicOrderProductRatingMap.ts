import { useQuery } from "@tanstack/react-query";
import { isValidPublicCode } from "@/synckerja-order/shared/lib/publicCode";
import { fetchPublicOrderProductRatingSummaries } from "../lib/fetchPublicOrderProductRatings";
import type { OrderProductRatingSummary } from "../lib/orderProductRatingTypes";

export function usePublicOrderProductRatingMap(args: {
  code: string;
  catalogItemIds: string[];
  enabled?: boolean;
}) {
  const idsKey = [...args.catalogItemIds].filter(Boolean).sort().join(",");
  return useQuery({
    queryKey: ["public-order-product-ratings", args.code, idsKey],
    queryFn: () =>
      fetchPublicOrderProductRatingSummaries({
        code: args.code,
        catalogItemIds: args.catalogItemIds,
      }),
    enabled:
      (args.enabled ?? true) &&
      isValidPublicCode(args.code) &&
      args.catalogItemIds.length > 0,
    staleTime: 60_000,
  });
}

export function ratingSummaryFor(
  map: Map<string, OrderProductRatingSummary> | undefined,
  catalogItemId: string,
): OrderProductRatingSummary | null {
  if (!map) return null;
  return map.get(catalogItemId) ?? null;
}
