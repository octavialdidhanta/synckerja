import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type InventoryMovementType =
  | "restock"
  | "adjustment"
  | "sale"
  | "cancel_restock"
  | "offline_sale"
  | "sync_correction";

export type InventoryPlatform =
  | "tiktok_shop"
  | "shopee"
  | "tokopedia"
  | "blibli";

export const INVENTORY_PLATFORMS: InventoryPlatform[] = [
  "tiktok_shop",
  "shopee",
  "tokopedia",
  "blibli",
];

export type ApplyMovementInput = {
  organizationId: string;
  skuId: string;
  movementType: InventoryMovementType;
  qtyDelta: number;
  platform?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdBy?: string | null;
  allowNegative?: boolean;
};

export type ApplyMovementResult = {
  movementId: string;
  qtyAfter: number;
};

export async function applyInventoryMovement(
  admin: SupabaseClient,
  input: ApplyMovementInput,
): Promise<ApplyMovementResult> {
  const { data: level, error: levelErr } = await admin
    .from("inventory_stock_levels")
    .select("id, available_qty")
    .eq("organization_id", input.organizationId)
    .eq("sku_id", input.skuId)
    .maybeSingle();

  if (levelErr) throw new Error(levelErr.message);
  if (!level) throw new Error("Stock level not found for SKU");

  const current = Number(level.available_qty) || 0;
  const next = current + input.qtyDelta;
  if (!input.allowNegative && next < 0) {
    throw new Error(`Insufficient stock: available ${current}, delta ${input.qtyDelta}`);
  }

  const { data: movement, error: movErr } = await admin
    .from("inventory_stock_movements")
    .insert({
      organization_id: input.organizationId,
      sku_id: input.skuId,
      movement_type: input.movementType,
      qty_delta: input.qtyDelta,
      qty_after: next,
      platform: input.platform ?? null,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      note: input.note ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (movErr || !movement?.id) {
    throw new Error(movErr?.message ?? "Failed to record movement");
  }

  const { error: updErr } = await admin
    .from("inventory_stock_levels")
    .update({ available_qty: next, updated_at: new Date().toISOString() })
    .eq("id", level.id);

  if (updErr) throw new Error(updErr.message);

  return { movementId: String(movement.id), qtyAfter: next };
}

export async function enqueueInventorySyncForSku(
  admin: SupabaseClient,
  organizationId: string,
  skuId: string,
  targetQty: number,
): Promise<void> {
  const { data: mappings } = await admin
    .from("inventory_platform_sku_mappings")
    .select("platform")
    .eq("organization_id", organizationId)
    .eq("sku_id", skuId)
    .eq("is_active", true);

  const platforms = new Set((mappings ?? []).map((m) => String(m.platform)));
  for (const platform of platforms) {
    await admin.from("inventory_sync_queue").insert({
      organization_id: organizationId,
      sku_id: skuId,
      target_platform: platform,
      target_qty: targetQty,
      status: "pending",
      scheduled_at: new Date().toISOString(),
    });
  }
}
