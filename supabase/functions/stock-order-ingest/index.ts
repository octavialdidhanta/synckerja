/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  stockManagementCorsHeaders,
  stockManagementJson,
} from "../_shared/inventory/stockManagementAuth.ts";
import {
  applyInventoryMovement,
  enqueueInventorySyncForSku,
} from "../_shared/inventory/inventoryLedger.ts";
import {
  readPlatformTikTokShopOAuth,
  requireTikTokShopPlatformConfigured,
} from "../_shared/tiktokShopAuth.ts";
import {
  getTikTokShopOrderDetails,
  type TikTokShopOrderLineItem,
} from "../_shared/tiktokShopApi.ts";
import { resolveOrgTikTokShopForOrders } from "../_shared/tiktokShopOrgResolver.ts";

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
  admin: ReturnType<typeof createClient>,
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

async function processTikTokOrderIngest(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  shopAccountId: string,
  orderId: string,
) {
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
    }

    if (isCancel && existing && !existing.movement_id) {
      // already handled
    } else if (isCancel && existing) {
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

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: stockManagementCorsHeaders });
    }
    if (req.method !== "POST") {
      return stockManagementJson({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return stockManagementJson({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const cronSecret = Deno.env.get("STOCK_CRON_SECRET")?.trim();
    const authHeader = req.headers.get("Authorization") ?? "";
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    let userId: string | null = null;
    if (!isCron) {
      const userRes = await getUserFromBearer(admin, authHeader);
      if ("error" in userRes) return userRes.error;
      userId = userRes.userId;
    }

    const organizationId = String(body.organization_id ?? "").trim();
    if (!organizationId) {
      return stockManagementJson({ error: "Missing organization_id" }, 400);
    }

    if (!isCron && userId) {
      const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
      if (orgForbidden) return orgForbidden;
    }

    const platformForbidden = requireTikTokShopPlatformConfigured();
    if (platformForbidden) return platformForbidden;

    const action = String(body.action ?? "pollTikTokOrders").trim();
    if (action !== "pollTikTokOrders" && action !== "ingestTikTokOrder") {
      return stockManagementJson({ error: "Unknown action" }, 400);
    }

    const shopAccountId = body.shop_account_id != null
      ? String(body.shop_account_id).trim()
      : null;

    if (action === "ingestTikTokOrder") {
      const orderId = String(body.order_id ?? "").trim();
      if (!shopAccountId || !orderId) {
        return stockManagementJson({ error: "Missing shop_account_id or order_id" }, 400);
      }
      const result = await processTikTokOrderIngest(admin, organizationId, shopAccountId, orderId);
      return stockManagementJson(result, 200);
    }

    // poll: fetch recent orders from metrics cache or direct API - simplified: require order_ids array
    const orderIds = Array.isArray(body.order_ids)
      ? body.order_ids.map((id) => String(id).trim()).filter(Boolean)
      : [];
    if (!shopAccountId || orderIds.length === 0) {
      return stockManagementJson({
        error: "pollTikTokOrders requires shop_account_id and order_ids[]",
      }, 400);
    }

    let totalProcessed = 0;
    for (const orderId of orderIds.slice(0, 50)) {
      const result = await processTikTokOrderIngest(
        admin,
        organizationId,
        shopAccountId,
        orderId,
      );
      totalProcessed += result.processed;
    }

    // Also run sync worker inline for immediate push
    try {
      await fetch(`${supabaseUrl}/functions/v1/stock-sync-worker`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    } catch {
      // non-fatal
    }

    return stockManagementJson({ processed: totalProcessed, order_count: orderIds.length }, 200);
  } catch (err) {
    console.error("stock-order-ingest:", err);
    return stockManagementJson(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
