import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  applyInventoryMovement,
  enqueueInventorySyncForSku,
} from "./inventoryLedger.ts";
import { readPlatformTikTokShopOAuth } from "../tiktokShopAuth.ts";
import {
  getTikTokShopOrderDetails,
  type TikTokShopOrderLineItem,
} from "../tiktokShopApi.ts";
import { resolveOrgTikTokShopForOrders } from "../tiktokShopOrgResolver.ts";

const DEDUCT_STATUSES = new Set([
  "AWAITING_SHIPMENT",
  "AWAITING_COLLECTION",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "PARTIALLY_SHIPPING",
]);

const CANCEL_STATUSES = new Set(["CANCELLED", "CANCELED"]);

async function findMappingForLineItem(
  admin: SupabaseClient,
  orgId: string,
  shopAccountId: string,
  item: TikTokShopOrderLineItem,
) {
  const sellerSku = item.seller_sku?.trim();
  const platformSkuId = item.sku_id?.trim();
  if (sellerSku) {
    const { data } = await admin
      .from("inventory_platform_sku_mappings")
      .select("sku_id")
      .eq("organization_id", orgId)
      .eq("platform", "tiktok_shop")
      .eq("shop_account_id", shopAccountId)
      .eq("seller_sku", sellerSku)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.sku_id) return String(data.sku_id);
  }
  if (platformSkuId) {
    const { data } = await admin
      .from("inventory_platform_sku_mappings")
      .select("sku_id")
      .eq("organization_id", orgId)
      .eq("platform", "tiktok_shop")
      .eq("shop_account_id", shopAccountId)
      .eq("platform_sku_id", platformSkuId)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.sku_id) return String(data.sku_id);
  }
  return null;
}

export async function processTikTokOrderIngest(
  admin: SupabaseClient,
  orgId: string,
  shopAccountId: string,
  orderId: string,
): Promise<{ processed: number; skipped: number }> {
  const oauth = readPlatformTikTokShopOAuth();
  if (!oauth) throw new Error("TikTok Shop not configured");

  const resolved = await resolveOrgTikTokShopForOrders(admin, orgId, shopAccountId);
  if (!resolved) throw new Error("TikTok Shop not connected");

  const detail = await getTikTokShopOrderDetails(
    oauth,
    resolved.accessToken,
    resolved.account.shop_cipher,
    [orderId],
  );
  const order = detail.orders[0];
  if (!order) return { processed: 0, skipped: 1 };

  const status = String(order.status ?? "").toUpperCase();
  const isCancel = CANCEL_STATUSES.has(status);
  const isDeduct = DEDUCT_STATUSES.has(status);
  if (!isCancel && !isDeduct) return { processed: 0, skipped: 1 };

  let processed = 0;
  for (let i = 0; i < order.line_items.length; i++) {
    const item = order.line_items[i];
    const lineId = item.sku_id || `${i}`;
    const externalLineId = `${lineId}:${item.seller_sku || i}`;

    const { data: existing } = await admin
      .from("inventory_order_deductions")
      .select("id, qty, movement_id")
      .eq("organization_id", orgId)
      .eq("platform", "tiktok_shop")
      .eq("external_order_id", orderId)
      .eq("external_line_id", externalLineId)
      .maybeSingle();

    const skuId = await findMappingForLineItem(admin, orgId, shopAccountId, item);
    if (!skuId) continue;

    const qty = Math.max(1, Math.floor(item.quantity || 1));

    if (isDeduct && !existing) {
      try {
        const result = await applyInventoryMovement(admin, {
          organizationId: orgId,
          skuId,
          movementType: "sale",
          qtyDelta: -qty,
          platform: "tiktok_shop",
          referenceType: "order",
          referenceId: orderId,
          note: `TikTok order ${orderId}`,
        });
        await admin.from("inventory_order_deductions").insert({
          organization_id: orgId,
          platform: "tiktok_shop",
          external_order_id: orderId,
          external_line_id: externalLineId,
          sku_id: skuId,
          qty,
          movement_id: result.movementId,
        });
        await enqueueInventorySyncForSku(admin, orgId, skuId, result.qtyAfter);
        processed++;
      } catch (err) {
        console.warn("order deduct failed:", orderId, err);
      }
    } else if (isCancel && existing?.movement_id) {
      try {
        const result = await applyInventoryMovement(admin, {
          organizationId: orgId,
          skuId,
          movementType: "cancel_restock",
          qtyDelta: qty,
          platform: "tiktok_shop",
          referenceType: "order_cancel",
          referenceId: orderId,
          note: `TikTok cancel ${orderId}`,
        });
        await enqueueInventorySyncForSku(admin, orgId, skuId, result.qtyAfter);
        processed++;
      } catch (err) {
        console.warn("cancel restock failed:", orderId, err);
      }
    }
  }

  return { processed, skipped: 0 };
}

export async function pollTikTokOrdersForStock(
  admin: SupabaseClient,
  orgId: string,
  shopAccountId: string,
  orderIds: string[],
): Promise<{ processed: number; order_count: number }> {
  let totalProcessed = 0;
  for (const orderId of orderIds.slice(0, 50)) {
    const result = await processTikTokOrderIngest(admin, orgId, shopAccountId, orderId);
    totalProcessed += result.processed;
  }
  return { processed: totalProcessed, order_count: orderIds.length };
}
