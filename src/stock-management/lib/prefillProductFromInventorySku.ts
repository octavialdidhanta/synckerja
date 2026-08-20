import type { DefaultPriceRow } from "@/8-2-1-default-prices/types/defaultPrices";
import type { InventorySkuRow } from "@/stock-management/types/inventory";

export function prefillProductFromInventorySku(args: {
  organizationId: string;
  sku: InventorySkuRow;
  outletId: string;
}): DefaultPriceRow {
  const displayName = args.sku.name?.trim() || args.sku.product_name?.trim() || args.sku.internal_sku;
  return {
    id: "",
    organization_id: args.organizationId,
    kind: "product",
    service_id: null,
    sub_service_id: null,
    unit_price: 0,
    name: displayName,
    unit: args.sku.unit || "pcs",
    track_stock: true,
    inventory_sku_id: args.sku.id,
    sku_code: args.sku.internal_sku,
    outlet_ids: [args.outletId],
    outlet_stocks: {
      [args.outletId]: {
        in_stock: Math.max(0, Number(args.sku.available_qty) || 0),
        alert_enabled: false,
        alert_at: null,
        track_cogs: false,
        avg_cost: 0,
      },
    },
  };
}
