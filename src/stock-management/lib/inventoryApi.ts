import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";

async function invokeStockApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("stock-management-api", { body });
  if (error) throw parseEdgeFunctionError(error, data);
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

export async function fetchInventorySkus(organizationId: string) {
  return invokeStockApi<{ rows: import("@/stock-management/types/inventory").InventorySkuRow[] }>({
    action: "listSkus",
    organization_id: organizationId,
  });
}

export async function createInventorySku(
  organizationId: string,
  payload: {
    internal_sku: string;
    name: string;
    product_name?: string;
    initial_qty?: number;
    unit?: string;
    variant_label?: string;
  },
) {
  return invokeStockApi<{ sku_id: string }>({
    action: "createSku",
    organization_id: organizationId,
    ...payload,
  });
}

export async function restockInventorySku(
  organizationId: string,
  skuId: string,
  qty: number,
  note?: string,
) {
  return invokeStockApi<{ movementId: string; qtyAfter: number }>({
    action: "restock",
    organization_id: organizationId,
    sku_id: skuId,
    qty,
    note,
  });
}

export async function adjustInventorySku(
  organizationId: string,
  skuId: string,
  qtyDelta: number,
  note?: string,
) {
  return invokeStockApi<{ movementId: string; qtyAfter: number }>({
    action: "adjust",
    organization_id: organizationId,
    sku_id: skuId,
    qty_delta: qtyDelta,
    note,
  });
}

export async function recordOfflineSale(
  organizationId: string,
  skuId: string,
  qty: number,
  note?: string,
) {
  return invokeStockApi<{ movementId: string; qtyAfter: number }>({
    action: "offlineSale",
    organization_id: organizationId,
    sku_id: skuId,
    qty,
    note,
  });
}

export async function fetchInventoryMovements(organizationId: string, skuId?: string) {
  return invokeStockApi<{ rows: import("@/stock-management/types/inventory").InventoryMovementRow[] }>({
    action: "listMovements",
    organization_id: organizationId,
    sku_id: skuId,
  });
}

export async function importInventoryCsv(
  organizationId: string,
  rows: Array<Record<string, unknown>>,
) {
  return invokeStockApi<{ created: number; errors: string[] }>({
    action: "importCsv",
    organization_id: organizationId,
    rows,
  });
}

export async function fetchPlatformMappings(organizationId: string) {
  return invokeStockApi<{ rows: import("@/stock-management/types/inventory").InventoryPlatformMappingRow[] }>({
    action: "listMappings",
    organization_id: organizationId,
  });
}

export async function upsertPlatformMapping(
  organizationId: string,
  payload: Record<string, unknown>,
) {
  return invokeStockApi<{ id: string }>({
    action: "upsertMapping",
    organization_id: organizationId,
    ...payload,
  });
}

export async function deletePlatformMapping(organizationId: string, id: string) {
  return invokeStockApi<{ ok: boolean }>({
    action: "deleteMapping",
    organization_id: organizationId,
    id,
  });
}

export async function fetchInventorySyncLogs(organizationId: string) {
  return invokeStockApi<{ rows: import("@/stock-management/types/inventory").InventorySyncLogRow[] }>({
    action: "listSyncLogs",
    organization_id: organizationId,
  });
}

export async function triggerInventorySync(organizationId: string, skuId: string) {
  return invokeStockApi<{ ok: boolean }>({
    action: "triggerSync",
    organization_id: organizationId,
    sku_id: skuId,
  });
}

export async function pollTikTokOrdersForStock(
  organizationId: string,
  shopAccountId: string,
  orderIds: string[],
) {
  return invokeStockApi<{ processed: number; order_count: number }>({
    action: "pollTikTokOrders",
    organization_id: organizationId,
    shop_account_id: shopAccountId,
    order_ids: orderIds,
  });
}

export async function processInventorySyncQueue(organizationId?: string) {
  return invokeStockApi<{ processed: number; succeeded: number; failed: number }>({
    action: "processSyncQueue",
    ...(organizationId ? { organization_id: organizationId } : {}),
  });
}
