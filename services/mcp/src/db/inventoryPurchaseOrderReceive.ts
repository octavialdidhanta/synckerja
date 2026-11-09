import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReceivePreviewInput, ReceiveWriteInput } from "../tools/inventory/purchaseOrderReceive";

type Session = { userId: string; organizationId: string };

/** Maps database refusals to stable codes the assistant can explain. */
export function throwReceive(message: string): never {
  if (message.includes("mcp_tool_confirmations_pkey")) throw new Error("confirmation_used");
  if (message.includes("not_a_member")) throw new Error("not_a_member");
  if (message.includes("catalog_inventory_feature_forbidden")) {
    throw new Error("catalog_inventory_feature_forbidden");
  }
  const catalogPo = message.match(/catalog_po_[a-z0-9_]+/);
  if (catalogPo) throw new Error(catalogPo[0]);
  if (message.includes("forbidden")) throw new Error("forbidden");
  if (message.includes("invalid_input")) throw new Error("invalid_input");
  throw new Error("query_failed");
}

function body(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("query_failed");
  return value as Record<string, unknown>;
}

/** Read-only: purchase orders still waiting to be received. */
export async function listOpenPurchaseOrders(
  admin: SupabaseClient,
  ctx: Session,
  outletId: string | null,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("mcp_list_open_purchase_orders", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: outletId,
  });
  if (error) throwReceive(error.message);
  const result = body(data);
  if (!Array.isArray(result.purchase_orders)) throw new Error("query_failed");
  return result;
}

/** Read-only: what receiving one PO would do, and whether this user may do it now. */
export async function previewReceivePurchaseOrder(
  admin: SupabaseClient,
  ctx: Session,
  input: ReceivePreviewInput,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("mcp_preview_receive_purchase_order", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_purchase_order_id: input.purchaseOrderId,
    p_order_number: input.orderNumber,
  });
  if (error) throwReceive(error.message);
  const result = body(data);
  if (typeof result.purchase_order_id !== "string") throw new Error("query_failed");
  return { ...result, saved: false };
}

/** Records the confirmation once and fulfills the PO as the session user, like the button. */
export async function receivePurchaseOrder(
  admin: SupabaseClient,
  ctx: Session,
  input: ReceiveWriteInput,
  confirmId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("mcp_confirm_receive_purchase_order", {
    p_confirm_id: confirmId,
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_purchase_order_id: input.purchaseOrderId,
    p_expected_total: input.expectedTotal,
    p_comment: input.comment,
  });
  if (error) throwReceive(error.message);
  const result = body(data);
  if (result.saved !== true) throw new Error("query_failed");
  return result;
}
