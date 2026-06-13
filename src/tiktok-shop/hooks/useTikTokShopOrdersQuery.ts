import { useQuery } from "@tanstack/react-query";
import { clampTikTokShopDateRange } from "@/tiktok-shop/lib/clampTikTokShopDateRange";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type TikTokShopOrderRow = {
  order_id: string;
  status: string;
  create_time: number | null;
  gmv: number;
  currency: string;
  units_sold: number;
  buyer_message?: string | null;
};

export type TikTokShopOrdersSummary = {
  gmv: number;
  order_count: number;
  units_sold: number;
  currency: string;
};

export type TikTokShopOrdersResponse = {
  summary: TikTokShopOrdersSummary;
  rows: TikTokShopOrderRow[];
  shop_account_id: string;
  shop_id: string;
  shop_name?: string | null;
  date_start: string;
  date_end: string;
  next_page_token: string | null;
  fetched_at?: string;
  cached?: boolean;
  code?: string;
  error?: string;
};

export async function fetchTikTokShopOrders(args: {
  organizationId: string;
  shopAccountId: string;
  dateStart: string;
  dateEnd: string;
  pageToken?: string;
  orderStatus?: string;
  forceRefresh?: boolean;
}): Promise<TikTokShopOrdersResponse> {
  const {
    organizationId,
    shopAccountId,
    dateStart,
    dateEnd,
    pageToken = "",
    orderStatus = "",
    forceRefresh = false,
  } = args;
  const { start, end } = clampTikTokShopDateRange(dateStart, dateEnd);
  const { data, error } = await supabase.functions.invoke("tiktok-shop-metrics", {
    body: {
      action: "getOrderDashboard",
      organization_id: organizationId,
      shop_account_id: shopAccountId,
      date_start: start,
      date_end: end,
      page_token: pageToken,
      order_status: orderStatus || undefined,
      force_refresh: forceRefresh,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokShopOrdersResponse & { error?: string; code?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useTikTokShopOrdersQuery(args: {
  organizationId: string | null | undefined;
  shopAccountId: string;
  dateStart: string;
  dateEnd: string;
  pageToken?: string;
  orderStatus?: string;
  enabled?: boolean;
}) {
  const {
    organizationId,
    shopAccountId,
    dateStart,
    dateEnd,
    pageToken = "",
    orderStatus = "",
    enabled = true,
  } = args;

  return useQuery({
    queryKey: [
      "tiktok-shop-orders",
      organizationId,
      shopAccountId,
      dateStart,
      dateEnd,
      orderStatus,
      pageToken,
    ],
    queryFn: async () => {
      if (!organizationId || !shopAccountId) return null;
      return fetchTikTokShopOrders({
        organizationId,
        shopAccountId,
        dateStart,
        dateEnd,
        pageToken,
        orderStatus: orderStatus || undefined,
      });
    },
    enabled: Boolean(organizationId && shopAccountId && enabled),
    staleTime: 60_000,
  });
}
