import { supabase } from "@/shared/lib/supabaseClient";

/** True when this open bill session already has a fulfillment (ship) stock movement. */
export async function sessionAlreadyFulfilled(args: {
  organizationId: string;
  sessionId: string;
}): Promise<boolean> {
  const { data, error } = await supabase
    .from("catalog_stock_movements")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("reference_type", "pos_fulfillment")
    .like("reference_id", `${args.sessionId}:%`)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
