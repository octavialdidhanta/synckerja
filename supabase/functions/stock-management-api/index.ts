/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  requireOrgAdmin,
  stockManagementCorsHeaders,
  stockManagementJson,
} from "../_shared/inventory/stockManagementAuth.ts";
import {
  applyInventoryMovement,
  enqueueInventorySyncForSku,
} from "../_shared/inventory/inventoryLedger.ts";
import { processInventorySyncQueue } from "../_shared/inventory/processSyncQueue.ts";
import {
  pollTikTokOrdersForStock,
  processTikTokOrderIngest,
} from "../_shared/inventory/processTikTokOrderIngest.ts";
import { requireTikTokShopPlatformConfigured } from "../_shared/tiktokShopAuth.ts";

type SkuRow = {
  id: string;
  organization_id: string;
  product_id: string;
  internal_sku: string;
  name: string;
  barcode: string | null;
  unit: string;
  variant_label: string | null;
  is_active: boolean;
  inventory_products?: { name: string } | { name: string }[] | null;
  inventory_stock_levels?: { available_qty: number; reserved_qty: number }[] | null;
};

function mapSkuRow(row: SkuRow) {
  const product = Array.isArray(row.inventory_products)
    ? row.inventory_products[0]
    : row.inventory_products;
  const level = Array.isArray(row.inventory_stock_levels)
    ? row.inventory_stock_levels[0]
    : row.inventory_stock_levels;
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: product?.name ?? "",
    internal_sku: row.internal_sku,
    name: row.name,
    barcode: row.barcode,
    unit: row.unit,
    variant_label: row.variant_label,
    is_active: row.is_active,
    available_qty: level?.available_qty ?? 0,
    reserved_qty: level?.reserved_qty ?? 0,
  };
}

async function handleListSkus(admin: ReturnType<typeof createClient>, orgId: string) {
  const { data, error } = await admin
    .from("inventory_skus")
    .select(`
      id, organization_id, product_id, internal_sku, name, barcode, unit, variant_label, is_active,
      inventory_products ( name ),
      inventory_stock_levels ( available_qty, reserved_qty )
    `)
    .eq("organization_id", orgId)
    .order("internal_sku", { ascending: true });

  if (error) return stockManagementJson({ error: error.message }, 500);
  return stockManagementJson({
    rows: ((data ?? []) as SkuRow[]).map(mapSkuRow),
  }, 200);
}

async function handleCreateSku(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const internalSku = String(body.internal_sku ?? "").trim();
  const name = String(body.name ?? body.product_name ?? internalSku).trim();
  const productName = String(body.product_name ?? name).trim();
  const initialQty = Math.max(0, Math.floor(Number(body.initial_qty ?? 0)));
  if (!internalSku) return stockManagementJson({ error: "Missing internal_sku" }, 400);

  const { data: product, error: prodErr } = await admin
    .from("inventory_products")
    .insert({
      organization_id: orgId,
      name: productName,
      description: body.description != null ? String(body.description) : null,
    })
    .select("id")
    .single();
  if (prodErr || !product?.id) {
    return stockManagementJson({ error: prodErr?.message ?? "Failed to create product" }, 500);
  }

  const { data: sku, error: skuErr } = await admin
    .from("inventory_skus")
    .insert({
      organization_id: orgId,
      product_id: product.id,
      internal_sku: internalSku,
      name,
      barcode: body.barcode != null ? String(body.barcode).trim() : null,
      unit: body.unit != null ? String(body.unit).trim() || "pcs" : "pcs",
      variant_label: body.variant_label != null ? String(body.variant_label).trim() : null,
    })
    .select("id")
    .single();
  if (skuErr || !sku?.id) {
    return stockManagementJson({ error: skuErr?.message ?? "Failed to create SKU" }, 500);
  }

  const { error: levelErr } = await admin.from("inventory_stock_levels").insert({
    organization_id: orgId,
    sku_id: sku.id,
    available_qty: 0,
    reserved_qty: 0,
  });
  if (levelErr) return stockManagementJson({ error: levelErr.message }, 500);

  if (initialQty > 0) {
    await applyInventoryMovement(admin, {
      organizationId: orgId,
      skuId: String(sku.id),
      movementType: "restock",
      qtyDelta: initialQty,
      note: "Initial stock",
      createdBy: userId,
      allowNegative: false,
    });
    await enqueueInventorySyncForSku(admin, orgId, String(sku.id), initialQty);
  }

  return stockManagementJson({ sku_id: sku.id }, 201);
}

async function handleRestockOrAdjust(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  body: Record<string, unknown>,
  movementType: "restock" | "adjustment" | "offline_sale",
) {
  const skuId = String(body.sku_id ?? "").trim();
  const qty = Math.floor(Number(body.qty ?? body.qty_delta ?? 0));
  if (!skuId) return stockManagementJson({ error: "Missing sku_id" }, 400);
  if (!Number.isFinite(qty) || qty === 0) {
    return stockManagementJson({ error: "Invalid qty" }, 400);
  }

  let qtyDelta = qty;
  if (movementType === "offline_sale" && qty > 0) qtyDelta = -qty;
  if (movementType === "adjustment" && body.qty_delta != null) {
    qtyDelta = Math.floor(Number(body.qty_delta));
  }

  const referenceType = body.reference_type != null ? String(body.reference_type).trim() : "";
  const referenceId = body.reference_id != null ? String(body.reference_id).trim() : "";
  if (movementType === "offline_sale" && referenceType && referenceId) {
    const { data: existing } = await admin
      .from("inventory_stock_movements")
      .select("id, qty_after")
      .eq("organization_id", orgId)
      .eq("sku_id", skuId)
      .eq("reference_type", referenceType)
      .eq("reference_id", referenceId)
      .maybeSingle();
    if (existing?.id) {
      return stockManagementJson({
        movementId: existing.id,
        qtyAfter: existing.qty_after,
        already_recorded: true,
      }, 200);
    }
  }

  try {
    const result = await applyInventoryMovement(admin, {
      organizationId: orgId,
      skuId,
      movementType,
      qtyDelta,
      note: body.note != null ? String(body.note) : null,
      createdBy: userId,
      platform: movementType === "offline_sale" ? "offline" : null,
      referenceType: body.reference_type != null ? String(body.reference_type) : null,
      referenceId: body.reference_id != null ? String(body.reference_id) : null,
    });
    await enqueueInventorySyncForSku(admin, orgId, skuId, result.qtyAfter);
    return stockManagementJson({ ...result }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return stockManagementJson({ error: message }, 400);
  }
}

async function handleListMovements(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  body: Record<string, unknown>,
) {
  const skuId = body.sku_id != null ? String(body.sku_id).trim() : "";
  let query = admin
    .from("inventory_stock_movements")
    .select("id, sku_id, movement_type, qty_delta, qty_after, platform, reference_type, reference_id, note, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (skuId) query = query.eq("sku_id", skuId);
  const { data, error } = await query;
  if (error) return stockManagementJson({ error: error.message }, 500);
  return stockManagementJson({ rows: data ?? [] }, 200);
}

async function handleImportCsv(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return stockManagementJson({ error: "Missing rows array" }, 400);
  }
  let created = 0;
  const errors: string[] = [];
  for (const raw of rows.slice(0, 500)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const internalSku = String(row.internal_sku ?? "").trim();
    if (!internalSku) {
      errors.push("Row missing internal_sku");
      continue;
    }
    const res = await handleCreateSku(admin, orgId, userId, {
      internal_sku: internalSku,
      name: row.name ?? internalSku,
      product_name: row.product_name ?? row.name ?? internalSku,
      initial_qty: row.initial_qty ?? row.qty ?? 0,
      unit: row.unit ?? "pcs",
    });
    if (res.status >= 400) {
      const payload = await res.clone().json().catch(() => ({}));
      errors.push(`${internalSku}: ${(payload as { error?: string }).error ?? res.status}`);
    } else {
      created++;
    }
  }
  return stockManagementJson({ created, errors }, 200);
}

async function handleListMappings(admin: ReturnType<typeof createClient>, orgId: string) {
  const { data, error } = await admin
    .from("inventory_platform_sku_mappings")
    .select(`
      id, sku_id, platform, platform_product_id, platform_sku_id, seller_sku,
      shop_account_id, warehouse_id, is_active,
      inventory_skus ( internal_sku, name )
    `)
    .eq("organization_id", orgId)
    .order("platform", { ascending: true });
  if (error) return stockManagementJson({ error: error.message }, 500);
  return stockManagementJson({ rows: data ?? [] }, 200);
}

async function handleUpsertMapping(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  body: Record<string, unknown>,
) {
  const skuId = String(body.sku_id ?? "").trim();
  const platform = String(body.platform ?? "").trim();
  if (!skuId || !platform) {
    return stockManagementJson({ error: "Missing sku_id or platform" }, 400);
  }

  const payload = {
    organization_id: orgId,
    sku_id: skuId,
    platform,
    platform_product_id: String(body.platform_product_id ?? "").trim(),
    platform_sku_id: String(body.platform_sku_id ?? "").trim(),
    seller_sku: String(body.seller_sku ?? "").trim(),
    shop_account_id: body.shop_account_id != null ? String(body.shop_account_id).trim() : null,
    warehouse_id: body.warehouse_id != null ? String(body.warehouse_id).trim() : null,
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  const mappingId = body.id != null ? String(body.id).trim() : "";
  if (mappingId) {
    const { error } = await admin
      .from("inventory_platform_sku_mappings")
      .update(payload)
      .eq("id", mappingId)
      .eq("organization_id", orgId);
    if (error) return stockManagementJson({ error: error.message }, 500);
    return stockManagementJson({ id: mappingId }, 200);
  }

  const { data, error } = await admin
    .from("inventory_platform_sku_mappings")
    .insert(payload)
    .select("id")
    .single();
  if (error) return stockManagementJson({ error: error.message }, 500);

  const { data: level } = await admin
    .from("inventory_stock_levels")
    .select("available_qty")
    .eq("sku_id", skuId)
    .maybeSingle();
  if (level) {
    await enqueueInventorySyncForSku(admin, orgId, skuId, Number(level.available_qty) || 0);
  }

  return stockManagementJson({ id: data?.id }, 201);
}

async function handleDeleteMapping(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  body: Record<string, unknown>,
) {
  const id = String(body.id ?? "").trim();
  if (!id) return stockManagementJson({ error: "Missing id" }, 400);
  const { error } = await admin
    .from("inventory_platform_sku_mappings")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return stockManagementJson({ error: error.message }, 500);
  return stockManagementJson({ ok: true }, 200);
}

async function handleListSyncLogs(admin: ReturnType<typeof createClient>, orgId: string) {
  const [{ data, error }, { data: mappings, error: mappingsErr }] = await Promise.all([
    admin
      .from("inventory_sync_logs")
      .select(`
        id, sku_id, platform, target_qty, success, error_message, created_at,
        inventory_skus (
          internal_sku,
          name,
          inventory_products ( name )
        )
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("inventory_platform_sku_mappings")
      .select("sku_id, platform, platform_product_id, platform_sku_id, seller_sku")
      .eq("organization_id", orgId)
      .eq("is_active", true),
  ]);
  if (error) return stockManagementJson({ error: error.message }, 500);
  if (mappingsErr) return stockManagementJson({ error: mappingsErr.message }, 500);

  const mappingByKey = new Map(
    (mappings ?? []).map((m) => [
      `${String(m.sku_id)}:${String(m.platform)}`,
      m,
    ]),
  );

  type SyncLogDbRow = {
    id: string;
    sku_id: string;
    platform: string;
    target_qty: number;
    success: boolean;
    error_message: string | null;
    created_at: string;
    inventory_skus?:
      | { internal_sku: string; name: string; inventory_products?: { name: string } | { name: string }[] | null }
      | Array<{
          internal_sku: string;
          name: string;
          inventory_products?: { name: string } | { name: string }[] | null;
        }>
      | null;
  };

  const rows = ((data ?? []) as SyncLogDbRow[]).map((row) => {
    const skuRef = Array.isArray(row.inventory_skus) ? row.inventory_skus[0] : row.inventory_skus;
    const productRef = Array.isArray(skuRef?.inventory_products)
      ? skuRef.inventory_products[0]
      : skuRef?.inventory_products;
    const mapping = mappingByKey.get(`${row.sku_id}:${row.platform}`);
    return {
      id: row.id,
      sku_id: row.sku_id,
      internal_sku: skuRef?.internal_sku ?? null,
      sku_name: skuRef?.name ?? null,
      product_name: productRef?.name ?? null,
      platform: row.platform,
      platform_product_id: mapping?.platform_product_id ?? null,
      platform_sku_id: mapping?.platform_sku_id ?? null,
      seller_sku: mapping?.seller_sku ?? null,
      target_qty: row.target_qty,
      success: row.success,
      error_message: row.error_message,
      created_at: row.created_at,
    };
  });

  return stockManagementJson({ rows }, 200);
}

async function handleTriggerSync(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  body: Record<string, unknown>,
) {
  const skuId = String(body.sku_id ?? "").trim();
  if (!skuId) return stockManagementJson({ error: "Missing sku_id" }, 400);
  const { data: level } = await admin
    .from("inventory_stock_levels")
    .select("available_qty")
    .eq("organization_id", orgId)
    .eq("sku_id", skuId)
    .maybeSingle();
  if (!level) return stockManagementJson({ error: "SKU not found" }, 404);
  await enqueueInventorySyncForSku(admin, orgId, skuId, Number(level.available_qty) || 0);
  try {
    await processInventorySyncQueue(admin, 20);
  } catch {
    // queue will be picked up by cron later
  }
  return stockManagementJson({ ok: true }, 200);
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

    const action = String(body.action ?? "listSkus").trim();
    const cronSecret = Deno.env.get("STOCK_CRON_SECRET")?.trim();
    const authHeader = req.headers.get("Authorization") ?? "";
    const isCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (action === "processSyncQueue" && isCron) {
      const result = await processInventorySyncQueue(admin, 20);
      return stockManagementJson(result, 200);
    }

    const userRes = await getUserFromBearer(admin, authHeader);
    if ("error" in userRes) return userRes.error;

    const organizationId = String(body.organization_id ?? "").trim();

    if (action === "processSyncQueue") {
      const adminForbidden = organizationId
        ? await requireOrgAdmin(admin, userRes.userId, organizationId)
        : null;
      if (adminForbidden) return adminForbidden;
      const result = await processInventorySyncQueue(admin, 20);
      return stockManagementJson(result, 200);
    }

    if (!organizationId) return stockManagementJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const readActions = new Set([
      "listSkus",
      "listMovements",
      "listMappings",
      "listSyncLogs",
    ]);

    const tiktokIngestActions = new Set(["pollTikTokOrders", "ingestTikTokOrder"]);
    if (tiktokIngestActions.has(action)) {
      const platformForbidden = requireTikTokShopPlatformConfigured();
      if (platformForbidden) return platformForbidden;

      const shopAccountId = body.shop_account_id != null
        ? String(body.shop_account_id).trim()
        : null;

      if (action === "ingestTikTokOrder") {
        const orderId = String(body.order_id ?? "").trim();
        if (!shopAccountId || !orderId) {
          return stockManagementJson({ error: "Missing shop_account_id or order_id" }, 400);
        }
        const result = await processTikTokOrderIngest(
          admin,
          organizationId,
          shopAccountId,
          orderId,
        );
        await processInventorySyncQueue(admin, 20).catch(() => {});
        return stockManagementJson(result, 200);
      }

      const orderIds = Array.isArray(body.order_ids)
        ? body.order_ids.map((id) => String(id).trim()).filter(Boolean)
        : [];
      if (!shopAccountId || orderIds.length === 0) {
        return stockManagementJson({
          error: "pollTikTokOrders requires shop_account_id and order_ids[]",
        }, 400);
      }
      const result = await pollTikTokOrdersForStock(
        admin,
        organizationId,
        shopAccountId,
        orderIds,
      );
      await processInventorySyncQueue(admin, 20).catch(() => {});
      return stockManagementJson(result, 200);
    }

    if (!readActions.has(action)) {
      const adminForbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
      if (adminForbidden) return adminForbidden;
    }

    switch (action) {
      case "listSkus":
        return handleListSkus(admin, organizationId);
      case "createSku":
        return handleCreateSku(admin, organizationId, userRes.userId, body);
      case "restock":
        return handleRestockOrAdjust(admin, organizationId, userRes.userId, body, "restock");
      case "adjust":
        return handleRestockOrAdjust(admin, organizationId, userRes.userId, body, "adjustment");
      case "offlineSale":
        return handleRestockOrAdjust(admin, organizationId, userRes.userId, body, "offline_sale");
      case "listMovements":
        return handleListMovements(admin, organizationId, body);
      case "importCsv":
        return handleImportCsv(admin, organizationId, userRes.userId, body);
      case "listMappings":
        return handleListMappings(admin, organizationId);
      case "upsertMapping":
        return handleUpsertMapping(admin, organizationId, body);
      case "deleteMapping":
        return handleDeleteMapping(admin, organizationId, body);
      case "listSyncLogs":
        return handleListSyncLogs(admin, organizationId);
      case "triggerSync":
        return handleTriggerSync(admin, organizationId, body);
      default:
        return stockManagementJson({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("stock-management-api:", err);
    return stockManagementJson(
      { error: err instanceof Error ? err.message : "Internal error" },
      500,
    );
  }
});
