import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  MarketplaceStockAdapter,
  MarketplaceStockPushInput,
  MarketplaceStockPushResult,
} from "./types.ts";
import { readPlatformTikTokShopOAuth } from "../tiktokShopAuth.ts";
import { updateTikTokShopSkuStock } from "../tiktokShopApi.ts";
import { resolveOrgTikTokShopForOrders } from "../tiktokShopOrgResolver.ts";

export function createTikTokShopStockAdapter(admin: SupabaseClient): MarketplaceStockAdapter {
  return {
    platform: "tiktok_shop",
    async pushStock(input: MarketplaceStockPushInput): Promise<MarketplaceStockPushResult> {
      const oauth = readPlatformTikTokShopOAuth();
      if (!oauth) {
        return { success: false, error: "TikTok Shop platform not configured" };
      }

      const shopAccountId = input.shopAccountId?.trim() || null;
      if (!shopAccountId) {
        return { success: false, error: "Missing TikTok shop_account_id on mapping" };
      }
      if (!input.platformProductId?.trim()) {
        return { success: false, error: "Missing platform_product_id on mapping" };
      }
      if (!input.platformSkuId?.trim()) {
        return { success: false, error: "Missing platform_sku_id on mapping" };
      }

      const resolved = await resolveOrgTikTokShopForOrders(
        admin,
        input.organizationId,
        shopAccountId,
      );
      if (!resolved) {
        return { success: false, error: "TikTok Shop not connected for this shop" };
      }

      try {
        await updateTikTokShopSkuStock(
          oauth,
          resolved.accessToken,
          resolved.account.shop_cipher,
          {
            productId: input.platformProductId.trim(),
            skuId: input.platformSkuId.trim(),
            warehouseId: input.warehouseId?.trim() || undefined,
            quantity: Math.max(0, Math.floor(input.targetQty)),
          },
        );
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  };
}
