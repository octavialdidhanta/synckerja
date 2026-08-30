import { supabase } from "@/shared/lib/supabaseClient";
import {
  DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
  parseKitchenFireBySalesType,
  type KitchenFireBySalesType,
} from "./kitchenFirePolicy";

const SELECT_FIRE_POLICY = "kitchen_fire_by_sales_type";

export async function loadKitchenFirePolicy(
  organizationId: string,
  outletId: string,
): Promise<KitchenFireBySalesType> {
  const { data, error } = await supabase
    .from("pos_kitchen_outlet_settings")
    .select(SELECT_FIRE_POLICY)
    .eq("organization_id", organizationId)
    .eq("outlet_id", outletId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ...DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE };
  return parseKitchenFireBySalesType(
    (data as { kitchen_fire_by_sales_type?: unknown }).kitchen_fire_by_sales_type,
  );
}
