import { useQuery } from "@tanstack/react-query";
import { clampTikTokShopDateRange } from "@/tiktok-shop/lib/clampTikTokShopDateRange";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { TikTokShopOrderRow, TikTokShopOrdersSummary } from "@/tiktok-shop/hooks/useTikTokShopOrdersQuery";

export type TikTokShopOrderLineItem = {
  sku_id: string;
  seller_sku: string;
  product_name: string;
  quantity: number;
  sale_price: number;
  currency: string;
};

export type TikTokShopOrderDetail = TikTokShopOrderRow & {
  update_time: number | null;
  shipping_type: string | null;
  tracking_number: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_address: string | null;
  payment_subtotal: number | null;
  payment_shipping: number | null;
  payment_tax: number | null;
  payment_discount: number | null;
  line_items: TikTokShopOrderLineItem[];
};

export type TikTokShopPeriodSummary = TikTokShopOrdersSummary & {
  pages_fetched?: number;
  truncated?: boolean;
};

export type TikTokShopPeriodSummaryResponse = {
  summary: TikTokShopPeriodSummary;
  shop_account_id: string;
  shop_id: string;
  shop_name?: string | null;
  date_start: string;
  date_end: string;
  order_status?: string | null;
  fetched_at?: string;
  cached?: boolean;
};

export async function fetchTikTokShopPeriodSummary(args: {
  organizationId: string;
  shopAccountId: string;
  dateStart: string;
  dateEnd: string;
  orderStatus?: string;
  forceRefresh?: boolean;
}): Promise<TikTokShopPeriodSummaryResponse> {
  const { organizationId, shopAccountId, dateStart, dateEnd, orderStatus, forceRefresh = false } =
    args;
  const { start, end } = clampTikTokShopDateRange(dateStart, dateEnd);
  const { data, error } = await supabase.functions.invoke("tiktok-shop-metrics", {
    body: {
      action: "getOrderPeriodSummary",
      organization_id: organizationId,
      shop_account_id: shopAccountId,
      date_start: start,
      date_end: end,
      order_status: orderStatus || undefined,
      force_refresh: forceRefresh,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokShopPeriodSummaryResponse & { error?: string; code?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useTikTokShopPeriodSummaryQuery(args: {
  organizationId: string | null | undefined;
  shopAccountId: string;
  dateStart: string;
  dateEnd: string;
  orderStatus?: string;
  enabled?: boolean;
}) {
  const {
    organizationId,
    shopAccountId,
    dateStart,
    dateEnd,
    orderStatus = "",
    enabled = true,
  } = args;

  return useQuery({
    queryKey: [
      "tiktok-shop-period-summary",
      organizationId,
      shopAccountId,
      dateStart,
      dateEnd,
      orderStatus,
    ],
    queryFn: async () => {
      if (!organizationId || !shopAccountId) return null;
      return fetchTikTokShopPeriodSummary({
        organizationId,
        shopAccountId,
        dateStart,
        dateEnd,
        orderStatus: orderStatus || undefined,
      });
    },
    enabled: Boolean(organizationId && shopAccountId && enabled),
    staleTime: 60_000,
  });
}

export type TikTokShopOrderDetailResponse = {
  orders: TikTokShopOrderDetail[];
  shop_account_id: string;
  shop_id: string;
};

export async function fetchTikTokShopOrderDetail(args: {
  organizationId: string;
  shopAccountId: string;
  orderIds: string[];
}): Promise<TikTokShopOrderDetailResponse> {
  const { organizationId, shopAccountId, orderIds } = args;
  const { data, error } = await supabase.functions.invoke("tiktok-shop-metrics", {
    body: {
      action: "getOrderDetail",
      organization_id: organizationId,
      shop_account_id: shopAccountId,
      order_ids: orderIds,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokShopOrderDetailResponse & { error?: string; code?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useTikTokShopOrderDetailQuery(args: {
  organizationId: string | null | undefined;
  shopAccountId: string;
  orderId: string | null;
  enabled?: boolean;
}) {
  const { organizationId, shopAccountId, orderId, enabled = true } = args;

  return useQuery({
    queryKey: ["tiktok-shop-order-detail", organizationId, shopAccountId, orderId],
    queryFn: async () => {
      if (!organizationId || !shopAccountId || !orderId) return null;
      return fetchTikTokShopOrderDetail({
        organizationId,
        shopAccountId,
        orderIds: [orderId],
      });
    },
    enabled: Boolean(organizationId && shopAccountId && orderId && enabled),
    staleTime: 30_000,
  });
}
