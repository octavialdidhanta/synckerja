import { useQuery } from "@tanstack/react-query";
import { isValidPublicCode } from "@/synckerja-order/shared/lib/publicCode";
import { fetchPublicOrderProductReviews } from "../lib/fetchPublicOrderProductRatings";

export function usePublicOrderProductReviews(args: {
  code: string;
  catalogItemId: string;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: [
      "public-order-product-reviews",
      args.code,
      args.catalogItemId,
      args.limit ?? 20,
      args.offset ?? 0,
    ],
    queryFn: () =>
      fetchPublicOrderProductReviews({
        code: args.code,
        catalogItemId: args.catalogItemId,
        limit: args.limit,
        offset: args.offset,
      }),
    enabled:
      (args.enabled ?? true) &&
      isValidPublicCode(args.code) &&
      Boolean(args.catalogItemId?.trim()),
    staleTime: 60_000,
  });
}
