import type { SupabaseClient } from "@supabase/supabase-js";

export type InventoryPurchaseOrder = {
  purchase_order_id: string;
  order_number: string;
  status: string;
  po_mode: string;
  stock_received: boolean;
  outlet_id: string;
  outlet_name: string;
  kind: "ingredient" | "product";
  name: string;
  variant_name: string | null;
  qty_added: number;
  unit_cost: number;
  qty_before: number;
  qty_after: number;
};

type Session = { userId: string; organizationId: string };

export type InventoryPurchaseOrderArgs = {
  outletId: string;
  search: string;
  qty: number;
  unitCost: number;
  supplierId: string | null;
  note: string | null;
};

function throwPurchaseOrder(message: string): never {
  if (message.includes("mcp_tool_confirmations_pkey")) throw new Error("confirmation_used");
  if (message.includes("not_a_member")) throw new Error("not_a_member");
  const ambiguousAt = message.indexOf("ambiguous");
  if (ambiguousAt >= 0) throw new Error(message.slice(ambiguousAt));
  if (message.includes("catalog_inventory_feature_forbidden")) {
    throw new Error("catalog_inventory_feature_forbidden");
  }
  const catalogPo = message.match(/catalog_po_[a-z0-9_]+/);
  if (catalogPo) throw new Error(catalogPo[0]);
  if (message.includes("not_found")) throw new Error("not_found");
  if (message.includes("forbidden")) throw new Error("forbidden");
  if (message.includes("invalid_input")) throw new Error("invalid_input");
  throw new Error("query_failed");
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function present(value: unknown): InventoryPurchaseOrder {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!body
    || typeof body.purchase_order_id !== "string"
    || typeof body.order_number !== "string"
    || typeof body.status !== "string"
    || typeof body.po_mode !== "string"
    || typeof body.outlet_id !== "string"
    || typeof body.outlet_name !== "string"
    || typeof body.name !== "string") {
    throw new Error("query_failed");
  }
  return {
    purchase_order_id: body.purchase_order_id,
    order_number: body.order_number,
    status: body.status,
    po_mode: body.po_mode,
    stock_received: body.stock_received === true,
    outlet_id: body.outlet_id,
    outlet_name: body.outlet_name,
    kind: body.kind === "ingredient" ? "ingredient" : "product",
    name: body.name,
    variant_name: typeof body.variant_name === "string" ? body.variant_name : null,
    qty_added: numberValue(body.qty_added),
    unit_cost: numberValue(body.unit_cost),
    qty_before: numberValue(body.qty_before),
    qty_after: numberValue(body.qty_after),
  };
}

export type InventoryPurchaseOrderPreview = {
  saved: false;
  outlet_id: string;
  outlet_name: string;
  kind: "ingredient" | "product";
  name: string;
  variant_name: string | null;
  unit_code: string | null;
  qty: number;
  unit_cost: number;
  subtotal: number;
  supplier_id: string | null;
  supplier_name: string | null;
  note: string | null;
  po_mode: string;
  stock_received_on_confirm: boolean;
  qty_before: number;
  qty_after_expected: number;
};

function presentPreview(value: unknown): InventoryPurchaseOrderPreview {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!body
    || typeof body.outlet_id !== "string"
    || typeof body.outlet_name !== "string"
    || typeof body.name !== "string"
    || typeof body.po_mode !== "string") {
    throw new Error("query_failed");
  }
  return {
    saved: false,
    outlet_id: body.outlet_id,
    outlet_name: body.outlet_name,
    kind: body.kind === "ingredient" ? "ingredient" : "product",
    name: body.name,
    variant_name: typeof body.variant_name === "string" ? body.variant_name : null,
    unit_code: typeof body.unit_code === "string" ? body.unit_code : null,
    qty: numberValue(body.qty),
    unit_cost: numberValue(body.unit_cost),
    subtotal: numberValue(body.subtotal),
    supplier_id: typeof body.supplier_id === "string" ? body.supplier_id : null,
    supplier_name: typeof body.supplier_name === "string" ? body.supplier_name : null,
    note: typeof body.note === "string" ? body.note : null,
    po_mode: body.po_mode,
    stock_received_on_confirm: body.stock_received_on_confirm === true,
    qty_before: numberValue(body.qty_before),
    qty_after_expected: numberValue(body.qty_after_expected),
  };
}

/** Read-only: validates and resolves the item exactly like the write, without creating anything. */
export async function previewInventoryPurchaseOrder(
  admin: SupabaseClient,
  ctx: Session,
  args: InventoryPurchaseOrderArgs,
): Promise<InventoryPurchaseOrderPreview> {
  const { data, error } = await admin.rpc("mcp_preview_inventory_purchase_order", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: args.outletId,
    p_search: args.search,
    p_qty: args.qty,
    p_unit_cost: args.unitCost,
    p_supplier_id: args.supplierId,
    p_note: args.note,
  });
  if (error) throwPurchaseOrder(error.message);
  return presentPreview(data);
}

/** Writes only with a confirmation id; the database records it so a confirmation is used once. */
export async function createInventoryPurchaseOrder(
  admin: SupabaseClient,
  ctx: Session,
  args: InventoryPurchaseOrderArgs,
  confirmId: string,
): Promise<InventoryPurchaseOrder> {
  const { data, error } = await admin.rpc("mcp_confirm_inventory_purchase_order", {
    p_confirm_id: confirmId,
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_outlet_id: args.outletId,
    p_search: args.search,
    p_qty: args.qty,
    p_unit_cost: args.unitCost,
    p_supplier_id: args.supplierId,
    p_note: args.note,
  });
  if (error) throwPurchaseOrder(error.message);
  return present(data);
}
