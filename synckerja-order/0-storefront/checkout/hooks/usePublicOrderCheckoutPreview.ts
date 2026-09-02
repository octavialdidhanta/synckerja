import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchPublicOrderCheckoutPreview } from "../../lib/orderCheckoutApi";
import { emptyOrderCheckoutPreview } from "../lib/orderCheckoutPreview";

export function usePublicOrderCheckoutPreview(args: {
  code: string;
  subtotal: number;
  enabled?: boolean;
}) {
  const subtotal = Math.max(0, Math.round(args.subtotal || 0));
  return useQuery({
    queryKey: ["public-order-checkout-preview", args.code, subtotal],
    queryFn: () => fetchPublicOrderCheckoutPreview({ code: args.code, subtotal }),
    enabled: Boolean(args.code) && args.enabled !== false && subtotal > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    select: (data) => (data.ok ? data : emptyOrderCheckoutPreview(subtotal)),
  });
}
