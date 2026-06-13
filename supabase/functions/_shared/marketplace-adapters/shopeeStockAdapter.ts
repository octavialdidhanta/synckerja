import type { MarketplaceStockAdapter, MarketplaceStockPushResult } from "./types.ts";

function stubAdapter(platform: string): MarketplaceStockAdapter {
  return {
    platform,
    async pushStock(): Promise<MarketplaceStockPushResult> {
      return {
        success: false,
        error: `${platform} integration not implemented yet (Phase 2–3)`,
      };
    },
  };
}

export const shopeeStockAdapter = stubAdapter("shopee");
export const tokopediaStockAdapter = stubAdapter("tokopedia");
export const blibliStockAdapter = stubAdapter("blibli");
