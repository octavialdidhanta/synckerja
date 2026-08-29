import { supabase } from "@/shared/lib/supabaseClient";

export async function applyCatalogIngredientProduce(args: {
  organizationId: string;
  outletId: string;
  outputIngredientId: string;
  produceQty: number;
  activityId: string;
}): Promise<void> {
  const { error } = await supabase.rpc("apply_catalog_ingredient_produce", {
    p_organization_id: args.organizationId,
    p_outlet_id: args.outletId,
    p_output_ingredient_id: args.outputIngredientId,
    p_produce_qty: args.produceQty,
    p_activity_id: args.activityId,
  });
  if (error) throw error;
}
