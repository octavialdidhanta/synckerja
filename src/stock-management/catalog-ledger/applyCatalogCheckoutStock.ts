import { supabase } from "@/shared/lib/supabaseClient";

export type CatalogCheckoutLine = {
  productId: string;
  qty: number;
  variantId?: string | null;
};

export async function applyCatalogCheckoutStock(args: {
  organizationId: string;
  outletId?: string | null;
  activityId: string;
  lines: CatalogCheckoutLine[];
}): Promise<void> {
  const payload = args.lines
    .filter((line) => line.productId && line.qty > 0)
    .map((line) => ({
      product_id: line.productId,
      qty: line.qty,
      variant_id: line.variantId ?? null,
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
