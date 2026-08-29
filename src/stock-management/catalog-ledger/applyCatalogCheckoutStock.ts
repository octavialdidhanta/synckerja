import { supabase } from "@/shared/lib/supabaseClient";

export type CatalogCheckoutLine = {
  productId: string;
  qty: number;
  variantId?: string | null;
  modifierOptionIds?: string[];
  lineKey?: string;
  stockScope?: "full" | "recipe_only" | "finished_goods_only";
};

export async function applyCatalogCheckoutStock(args: {
  organizationId: string;
  outletId?: string | null;
  activityId: string;
  lines: CatalogCheckoutLine[];
}): Promise<void> {
  const payload = args.lines
    .filter((line) => line.productId && line.qty > 0)
    .map((line, index) => ({
      product_id: line.productId,
      qty: line.qty,
      variant_id: line.variantId ?? null,
      modifier_option_ids: (line.modifierOptionIds ?? []).filter(Boolean),
      line_key: line.lineKey ?? `L${index + 1}`,
      stock_scope: line.stockScope ?? "full",
    }));
  if (payload.length === 0) return;
  const { error } = await supabase.rpc("apply_catalog_checkout_stock", {
    p_organization_id: args.organizationId,
    p_outlet_id: args.outletId ?? null,
    p_activity_id: args.activityId,
    p_lines: payload,
  });
  if (error) throw error;
}
