/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stockManagementCorsHeaders, stockManagementJson } from "../_shared/inventory/stockManagementAuth.ts";
import { createTikTokShopStockAdapter } from "../_shared/marketplace-adapters/tiktokShopStockAdapter.ts";
import {
  blibliStockAdapter,
  shopeeStockAdapter,
  tokopediaStockAdapter,
} from "../_shared/marketplace-adapters/shopeeStockAdapter.ts";
import type { MarketplaceStockAdapter } from "../_shared/marketplace-adapters/types.ts";

const MAX_ATTEMPTS = 5;

function getAdapter(
  admin: ReturnType<typeof createClient>,
  platform: string,
): MarketplaceStockAdapter {
  switch (platform) {
    case "tiktok_shop":
      return createTikTokShopStockAdapter(admin);
    case "shopee":
      return shopeeStockAdapter;
    case "tokopedia":
      return tokopediaStockAdapter;
    case "blibli":
      return blibliStockAdapter;
    default:
      return shopeeStockAdapter;
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: stockManagementCorsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return stockManagementJson({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const batchSize = 20;

    const { data: jobs, error: jobsErr } = await admin
      .from("inventory_sync_queue")
      .select("id, organization_id, sku_id, target_platform, target_qty, attempts")
      .in("status", ["pending", "failed"])
      .lte("scheduled_at", new Date().toISOString())
      .lt("attempts", MAX_ATTEMPTS)
      .order("scheduled_at", { ascending: true })
      .limit(batchSize);

    if (jobsErr) {
      return stockManagementJson({ error: jobsErr.message }, 500);
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs ?? []) {
      processed++;
      const jobId = String(job.id);
      const orgId = String(job.organization_id);
      const skuId = String(job.sku_id);
      const platform = String(job.target_platform);

      await admin
        .from("inventory_sync_queue")
        .update({ status: "processing" })
        .eq("id", jobId);

      const { data: mapping } = await admin
        .from("inventory_platform_sku_mappings")
        .select("id, platform_product_id, platform_sku_id, seller_sku, shop_account_id, warehouse_id")
        .eq("organization_id", orgId)
        .eq("sku_id", skuId)
        .eq("platform", platform)
        .eq("is_active", true)
        .maybeSingle();

      if (!mapping) {
        await admin.from("inventory_sync_queue").update({
          status: "failed",
          attempts: (Number(job.attempts) || 0) + 1,
          last_error: "No active platform mapping",
          processed_at: new Date().toISOString(),
        }).eq("id", jobId);
        failed++;
        continue;
      }

      const adapter = getAdapter(admin, platform);
      const result = await adapter.pushStock({
        organizationId: orgId,
        mappingId: String(mapping.id),
        skuId,
        platformProductId: String(mapping.platform_product_id ?? ""),
        platformSkuId: String(mapping.platform_sku_id ?? ""),
        sellerSku: String(mapping.seller_sku ?? ""),
        shopAccountId: mapping.shop_account_id != null ? String(mapping.shop_account_id) : null,
        warehouseId: mapping.warehouse_id != null ? String(mapping.warehouse_id) : null,
        targetQty: Number(job.target_qty) || 0,
      });

      await admin.from("inventory_sync_logs").insert({
        organization_id: orgId,
        sku_id: skuId,
        platform,
        target_qty: Number(job.target_qty) || 0,
        success: result.success,
        error_message: result.error ?? null,
      });

      if (result.success) {
        succeeded++;
        await admin.from("inventory_sync_queue").update({
          status: "completed",
          processed_at: new Date().toISOString(),
          last_error: null,
        }).eq("id", jobId);
      } else {
        failed++;
        const attempts = (Number(job.attempts) || 0) + 1;
        await admin.from("inventory_sync_queue").update({
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          last_error: result.error ?? "Sync failed",
          scheduled_at: new Date(Date.now() + attempts * 60_000).toISOString(),
          processed_at: new Date().toISOString(),
        }).eq("id", jobId);
      }
    }

    return stockManagementJson({ processed, succeeded, failed }, 200);
  } catch (err) {
    console.error("stock-sync-worker:", err);
    return stockManagementJson(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
