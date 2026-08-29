import { supabase } from "@/shared/lib/supabaseClient";

/** Product ids that have a base recipe (modifier_option_id IS NULL). */
export async function fetchProductIdsWithBaseRecipe(args: {
  organizationId: string;
  productIds: string[];
}): Promise<Set<string>> {
  const ids = [...new Set(args.productIds.filter(Boolean))];
  if (ids.length === 0) return new Set();

  const { data, error } = await supabase
    .from("catalog_product_recipes")
    .select("product_id")
    .in("product_id", ids)
    .is("modifier_option_id", null);
  if (error) throw error;
  return new Set((data ?? []).map((row) => String(row.product_id)));
}
