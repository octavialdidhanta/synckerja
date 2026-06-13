export type MarketplaceStockPushInput = {
  organizationId: string;
  mappingId: string;
  skuId: string;
  platformProductId: string;
  platformSkuId: string;
  sellerSku: string;
  shopAccountId: string | null;
  warehouseId: string | null;
  targetQty: number;
};

export type MarketplaceStockPushResult = {
  success: boolean;
  error?: string;
};

export interface MarketplaceStockAdapter {
  platform: string;
  pushStock(input: MarketplaceStockPushInput): Promise<MarketplaceStockPushResult>;
}
