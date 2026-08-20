import { supabase } from "@/shared/lib/supabaseClient";

export type ApplyCatalogStockMovementInput = {
  organizationId: string;
  outletId: string;
  itemKind: "product" | "ingredient";
  productId?: string | null;
  variantId?: string | null;
  ingredientId?: string | null;
  movementType: "opening" | "adjustment";
  qtyDelta: number;
  note?: string;
  referenceType?: string | null;
  referenceId?: string | null;
};

export async function applyCatalogStockMovement(input: ApplyCatalogStockMovementInput): Promise<void> {
  if (!input.outletId || !Number.isFinite(input.qtyDelta) || input.qtyDelta === 0) return;
  const { error } = await supabase.rpc("apply_catalog_stock_movement", {
    p_organization_id: input.organizationId,
    p_outlet_id: input.outletId,
    p_item_kind: input.itemKind,
    p_product_id: input.productId ?? null,
    p_variant_id: input.variantId ?? null,
    p_ingredient_id: input.ingredientId ?? null,
    p_movement_type: input.movementType,
    p_qty_delta: input.qtyDelta,
    p_reference_type: input.referenceType ?? null,
    p_reference_id: input.referenceId ?? null,
    p_note: input.note ?? null,
  });
  if (error) throw error;
}

export async function syncCatalogStockToTarget(args: {
  organizationId: string;
  outletId: string;
  itemKind: "product" | "ingredient";
  productId?: string | null;
  variantId?: string | null;
  ingredientId?: string | null;
  previousQty: number;
  targetQty: number;
  previouslyTracked: boolean;
}): Promise<void> {
  const delta = args.targetQty - args.previousQty;
  if (!args.outletId || delta === 0) return;
  await applyCatalogStockMovement({
    organizationId: args.organizationId,
    outletId: args.outletId,
    itemKind: args.itemKind,
    productId: args.productId,
    variantId: args.variantId,
    ingredientId: args.ingredientId,
    movementType: args.previouslyTracked ? "adjustment" : "opening",
    qtyDelta: delta,
  });
}
