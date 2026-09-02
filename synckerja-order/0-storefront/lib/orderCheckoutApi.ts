import { supabase } from "@/shared/lib/supabaseClient";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { normalizePublicCode } from "@/synckerja-order/shared/lib/publicCode";
import {
  parseOrderFulfillment,
  type OrderFulfillment,
} from "../checkout/lib/orderFulfillment";
import {
  emptyOrderCheckoutPreview,
  type OrderCheckoutFeeLine,
  type OrderCheckoutPreview,
} from "../checkout/lib/orderCheckoutPreview";

type GuestCheckoutFields = {
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  billNote?: string;
  fulfillment?: OrderFulfillment;
};

function guestRpcFields(args: GuestCheckoutFields) {
  return {
    p_guest_name: args.guestName?.trim() || null,
    p_guest_phone: args.guestPhone?.trim() || null,
    p_guest_email: args.guestEmail?.trim() || null,
    p_bill_note: args.billNote?.trim() || null,
  };
}

function asFeeLines(value: unknown): OrderCheckoutFeeLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const rec = row as Record<string, unknown>;
      const name = String(rec.name ?? "").trim();
      const amount = Math.round(Number(rec.amount ?? 0));
      if (!name || !Number.isFinite(amount) || amount <= 0) return null;
      const amountPercent = Number(rec.amount_percent ?? rec.amountPercent ?? 0);
      return {
        name,
        amount,
        amount_percent: Number.isFinite(amountPercent) ? amountPercent : undefined,
      };
    })
    .filter((row): row is OrderCheckoutFeeLine => Boolean(row));
}

export async function fetchPublicOrderCheckoutPreview(args: {
  code: string;
  subtotal: number;
}): Promise<OrderCheckoutPreview> {
  const subtotal = Math.max(0, Math.round(args.subtotal || 0));
  const fallback = emptyOrderCheckoutPreview(subtotal);
  const { data, error } = await supabase.rpc("get_public_synckerja_order_checkout_preview", {
    p_code: normalizePublicCode(args.code),
    p_subtotal: subtotal,
  });
  if (error) return { ...fallback, ok: false, error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.ok === false) {
    return { ...fallback, ok: false, error: String(row.error ?? "failed") };
  }
  const taxLines = asFeeLines(row.taxLines);
  const gratuityLines = asFeeLines(row.gratuityLines);
  const taxTotal = Math.round(Number(row.taxTotal ?? 0)) || taxLines.reduce((sum, line) => sum + line.amount, 0);
  const gratuityTotal =
    Math.round(Number(row.gratuityTotal ?? 0)) ||
    gratuityLines.reduce((sum, line) => sum + line.amount, 0);
  const parsedSubtotal = Math.round(Number(row.subtotal ?? subtotal)) || subtotal;
  const grandTotal =
    Math.round(Number(row.grandTotal ?? parsedSubtotal + taxTotal + gratuityTotal)) ||
    parsedSubtotal + taxTotal + gratuityTotal;
  return {
    ok: true,
    subtotal: parsedSubtotal,
    taxBase: Number(row.taxBase ?? parsedSubtotal),
    taxLines,
    gratuityLines,
    taxTotal,
    gratuityTotal,
    grandTotal,
    applicationMethod: typeof row.applicationMethod === "string" ? row.applicationMethod : undefined,
  };
}

export async function submitOrderPayLater(args: {
  code: string;
  tableNumber: string;
  lines: CustomerVisitCartLine[];
} & GuestCheckoutFields): Promise<{ ok: boolean; error?: string; session_id?: string }> {
  const { data, error } = await supabase.rpc("submit_synckerja_order_pay_later", {
    p_code: normalizePublicCode(args.code),
    p_table_name: args.tableNumber.trim(),
    p_cart: args.lines,
    ...guestRpcFields(args),
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: "failed" }) as {
    ok: boolean;
    error?: string;
    session_id?: string;
  };
}

export async function createOrderQrisCheckout(args: {
  code: string;
  tableNumber: string;
  lines: CustomerVisitCartLine[];
} & GuestCheckoutFields): Promise<{
  ok: boolean;
  error?: string;
  pending_checkout_id?: string;
  session_id?: string;
  fulfillment?: OrderFulfillment;
}> {
  const fulfillment = parseOrderFulfillment(args.fulfillment ?? "dine_in");
  const { data, error } = await supabase.rpc("submit_synckerja_order_create_qris", {
    p_code: normalizePublicCode(args.code),
    p_table_name: args.tableNumber.trim(),
    p_cart: args.lines,
    p_fulfillment: fulfillment,
    ...guestRpcFields(args),
  });
  if (error) return { ok: false, error: error.message };
  const row = (data ?? { ok: false, error: "failed" }) as {
    ok: boolean;
    error?: string;
    pending_checkout_id?: string;
    session_id?: string;
    fulfillment?: string;
  };
  return {
    ...row,
    fulfillment: row.fulfillment ? parseOrderFulfillment(row.fulfillment) : fulfillment,
  };
}

export async function invokePublicOrderQris(args: {
  code: string;
  pendingCheckoutId: string;
}): Promise<{
  ok: boolean;
  error?: string;
  payment_request?: { id?: string; qr_string?: string; expires_at?: string };
}> {
  const { data, error } = await supabase.functions.invoke("xendit-api", {
    body: {
      action: "createPublicOrderQris",
      public_code: normalizePublicCode(args.code),
      pending_checkout_id: args.pendingCheckoutId,
    },
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false }) as {
    ok: boolean;
    error?: string;
    payment_request?: { id?: string; qr_string?: string; expires_at?: string };
  };
}

export async function pollPublicOrderQris(args: {
  code: string;
  pendingCheckoutId: string;
}): Promise<{ ok: boolean; status?: string; sales_activity_id?: string | null }> {
  const { data, error } = await supabase.rpc("get_public_synckerja_order_qris_status", {
    p_code: normalizePublicCode(args.code),
    p_pending_id: args.pendingCheckoutId,
  });
  if (error) return { ok: false };
  return (data ?? { ok: false }) as {
    ok: boolean;
    status?: string;
    sales_activity_id?: string | null;
  };
}

export async function completePublicOrderQris(args: {
  code: string;
  pendingCheckoutId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("complete_synckerja_order_qris", {
    p_code: normalizePublicCode(args.code),
    p_pending_id: args.pendingCheckoutId,
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false }) as { ok: boolean; error?: string };
}

export async function submitOrderPayAtCashier(args: {
  code: string;
  tableNumber: string;
  lines: CustomerVisitCartLine[];
} & GuestCheckoutFields): Promise<{
  ok: boolean;
  error?: string;
  pending_checkout_id?: string;
  session_id?: string;
  claim_token?: string;
  grand_total?: number;
  expires_at?: string;
  updated_in_place?: boolean;
  fulfillment?: OrderFulfillment;
}> {
  const fulfillment = parseOrderFulfillment(args.fulfillment ?? "dine_in");
  const { data, error } = await supabase.rpc("submit_synckerja_order_pay_at_cashier", {
    p_code: normalizePublicCode(args.code),
    p_table_name: args.tableNumber.trim(),
    p_guest_name: args.guestName?.trim() || "Walk-in",
    p_cart: args.lines,
    p_fulfillment: fulfillment,
    ...guestRpcFields(args),
  });
  if (error) return { ok: false, error: error.message };
  const row = (data ?? { ok: false, error: "failed" }) as {
    ok: boolean;
    error?: string;
    pending_checkout_id?: string;
    session_id?: string;
    claim_token?: string;
    grand_total?: number;
    expires_at?: string;
    updated_in_place?: boolean;
    fulfillment?: string;
  };
  return {
    ...row,
    fulfillment: row.fulfillment ? parseOrderFulfillment(row.fulfillment) : fulfillment,
  };
}

export async function fetchCashierTicketStatus(args: {
  code: string;
  claimToken: string;
}): Promise<{
  ok: boolean;
  error?: string;
  status?: string;
  table_number?: string;
  grand_total?: number;
  expires_at?: string;
  claimed?: boolean;
  paid?: boolean;
  cart?: unknown;
  checkout_totals?: unknown;
  bill_note?: string | null;
  cart_updated_at?: string;
  fulfillment?: OrderFulfillment;
  sales_type_label?: string;
}> {
  const { data, error } = await supabase.rpc("get_public_synckerja_order_cashier_ticket", {
    p_code: normalizePublicCode(args.code),
    p_claim_token: args.claimToken.trim().toUpperCase(),
  });
  if (error) return { ok: false, error: error.message };
  const row = (data ?? { ok: false }) as {
    ok: boolean;
    error?: string;
    status?: string;
    table_number?: string;
    grand_total?: number;
    expires_at?: string;
    claimed?: boolean;
    paid?: boolean;
    cart?: unknown;
    checkout_totals?: unknown;
    bill_note?: string | null;
    cart_updated_at?: string;
    fulfillment?: string;
    sales_type_label?: string;
  };
  return {
    ...row,
    fulfillment: row.fulfillment ? parseOrderFulfillment(row.fulfillment) : undefined,
  };
}
