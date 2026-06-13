import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { TikTokShopOAuthReturnPath } from "@/tiktok-shop/settings/tiktokShopSettingsPaths";

export type TikTokShopAccountRow = {
  id: string;
  seller_open_id: string;
  shop_id: string;
  shop_cipher: string;
  shop_name: string | null;
  region: string | null;
  seller_type: string | null;
  label: string;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
};

export type TikTokShopSellerRow = {
  seller_open_id: string;
  seller_name: string | null;
  seller_base_region: string | null;
  shops: TikTokShopAccountRow[];
};

export type TikTokShopConnectionRow = {
  organization_id: string;
  is_active: boolean;
  oauth_connected_at: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
  updated_at: string;
};

type SettingsResponse = {
  connection: TikTokShopConnectionRow | null;
  oauthConnected: boolean;
  sellers: TikTokShopSellerRow[];
  serverConfigured?: boolean;
};

async function invokeConfig(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke("tiktok-shop-config", {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | SettingsResponse;
  if (payload && "error" in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export function useTikTokShopSettings(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const queryKey = ["tiktok-shop-settings", organizationId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      return (await invokeConfig(organizationId, "getSettings")) as SettingsResponse;
    },
    enabled: Boolean(organizationId) && options?.enabled !== false,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const startOAuth = useMutation({
    mutationFn: async (returnPath?: TikTokShopOAuthReturnPath) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("tiktok-shop-oauth-start", {
        body: {
          organization_id: organizationId,
          ...(returnPath ? { return_path: returnPath } : {}),
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error((data as { error?: string })?.error ?? "No OAuth URL");
      window.location.href = url;
    },
  });

  const disconnect = useMutation({
    mutationFn: async (sellerOpenId?: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(
        organizationId,
        "disconnect",
        sellerOpenId ? { seller_open_id: sellerOpenId } : {},
      );
    },
    onSuccess: invalidate,
  });

  const setDefaultShop = useMutation({
    mutationFn: async (accountId: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "setDefaultShop", { account_id: accountId });
    },
    onSuccess: invalidate,
  });

  const deleteShop = useMutation({
    mutationFn: async (accountId: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeConfig(organizationId, "deleteShop", { account_id: accountId });
    },
    onSuccess: invalidate,
  });

  const syncAuthorizedShops = useMutation({
    mutationFn: async (sellerOpenId: string) => {
      if (!organizationId) throw new Error("No organization");
      return invokeConfig(organizationId, "syncAuthorizedShops", {
        seller_open_id: sellerOpenId,
      });
    },
    onSuccess: invalidate,
  });

  const testConnection = useMutation({
    mutationFn: async (sellerOpenId?: string) => {
      if (!organizationId) throw new Error("No organization");
      return invokeConfig(
        organizationId,
        "testConnection",
        sellerOpenId ? { seller_open_id: sellerOpenId } : {},
      );
    },
    onSuccess: invalidate,
  });

  return {
    ...query,
    startOAuth,
    disconnect,
    setDefaultShop,
    deleteShop,
    syncAuthorizedShops,
    testConnection,
  };
}
