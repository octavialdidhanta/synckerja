import { supabase } from "@/shared/lib/supabaseClient";

export async function applyCatalogFulfillmentStock(args: {
  organizationId: string;
  outletId: string;
  sessionId: string;
  lines: Array<{
    product_id: string;
    qty: number;
    variant_id: string | null;
    line_key: string;
  }>;
  fulfillmentId?: string;
}): Promise<void> {
  if (args.lines.length === 0) return;
  const { error } = await supabase.rpc("apply_catalog_fulfillment_stock", {
    p_organization_id: args.organizationId,
    p_outlet_id: args.outletId,
    p_session_id: args.sessionId,
    p_lines: args.lines,
    p_fulfillment_id: args.fulfillmentId ?? null,
  });
  if (error) throw error;
}

export async function applyCatalogStockReserve(args: {
  organizationId: string;
  outletId: string;
  sessionId: string;
  lines: Array<{
    product_id: string;
    qty: number;
    variant_id: string | null;
  }>;
  reserveId?: string;
}): Promise<void> {
  if (args.lines.length === 0) return;
  const { error } = await supabase.rpc("apply_catalog_stock_reserve", {
    p_organization_id: args.organizationId,
    p_outlet_id: args.outletId,
    p_session_id: args.sessionId,
    p_lines: args.lines,
    p_reserve_id: args.reserveId ?? null,
  });
  if (error) throw error;
}

export async function releaseCatalogStockReserve(args: {
  organizationId: string;
  outletId: string;
  sessionId: string;
  lines: Array<{
    product_id: string;
    qty: number;
    variant_id: string | null;
  }> | null;
  releaseId?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("release_catalog_stock_reserve", {
    p_organization_id: args.organizationId,
    p_outlet_id: args.outletId,
    p_session_id: args.sessionId,
    p_lines: args.lines,
    p_release_id: args.releaseId ?? null,
  });
  if (error) throw error;
}

export async function reverseStoreCheckoutStock(args: {
  organizationId: string;
  activityId: string;
  reverseId?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("reverse_store_checkout_stock", {
    p_organization_id: args.organizationId,
    p_activity_id: args.activityId,
    p_reverse_id: args.reverseId ?? null,
  });
  if (error) throw error;
}

export { reverseCatalogKitchenCommit } from "./applyCatalogKitchenCommitStock";
