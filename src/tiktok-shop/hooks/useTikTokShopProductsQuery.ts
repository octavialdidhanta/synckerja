import { useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type TikTokShopProductSku = {
  sku_id: string;
  seller_sku: string;
  price: number;
  currency: string;
  stock: number | null;
};

export type TikTokShopProductRow = {
  product_id: string;
  title: string;
  status: string;
  create_time: number | null;
  update_time: number | null;
  skus: TikTokShopProductSku[];
};

export type TikTokShopProductsResponse = {
  rows: TikTokShopProductRow[];
  summary: { total_count: number };
  shop_account_id: string;
  shop_id: string;
  shop_name?: string | null;
  status?: string | null;
  next_page_token: string | null;
  fetched_at?: string;
  cached?: boolean;
};

export async function fetchTikTokShopProducts(args: {
  organizationId: string;
  shopAccountId: string;
  pageToken?: string;
  status?: string;
  forceRefresh?: boolean;
}): Promise<TikTokShopProductsResponse> {
  const {
    organizationId,
    shopAccountId,
    pageToken = "",
    status = "",
    forceRefresh = false,
  } = args;
  const { data, error } = await supabase.functions.invoke("tiktok-shop-catalog", {
    body: {
      action: "getProductList",
      organization_id: organizationId,
      shop_account_id: shopAccountId,
      page_token: pageToken,
      status: status || undefined,
      force_refresh: forceRefresh,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokShopProductsResponse & { error?: string; code?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useTikTokShopProductsQuery(args: {
  organizationId: string | null | undefined;
  shopAccountId: string;
  pageToken?: string;
  status?: string;
  enabled?: boolean;
}) {
  const {
    organizationId,
    shopAccountId,
    pageToken = "",
    status = "",
    enabled = true,
  } = args;

  return useQuery({
    queryKey: [
      "tiktok-shop-products",
      organizationId,
      shopAccountId,
      status,
      pageToken,
    ],
    queryFn: async () => {
      if (!organizationId || !shopAccountId) return null;
      return fetchTikTokShopProducts({
        organizationId,
        shopAccountId,
        pageToken,
        status: status || undefined,
      });
    },
    enabled: Boolean(organizationId && shopAccountId && enabled),
    staleTime: 60_000,
  });
}
