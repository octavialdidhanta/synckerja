import { supabase } from "@/shared/lib/supabaseClient";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";

export type ClaimSynckerjaCashierResult = {
  ok: boolean;
  error?: string;
  pending_checkout_id?: string;
  session_id?: string;
  checkout_channel?: string;
  cart_snapshot?: CustomerVisitCartLine[];
  customer_name?: string | null;
  customer_phone?: string | null;
  table_name?: string;
  pos_table_id?: string | null;
  group_id?: string | null;
  pax?: number;
  seated_at?: string;
  kitchen_fired?: boolean;
  catalog_sales_type_id?: string | null;
  sales_type_label?: string | null;
  fulfillment?: string | null;
};

export async function claimSynckerjaCashierCheckout(args: {
  claimToken: string;
  outletId: string;
}): Promise<ClaimSynckerjaCashierResult> {
  const { data, error } = await supabase.rpc("pos_claim_synckerja_cashier_checkout", {
    p_claim_token: args.claimToken.trim().toUpperCase(),
    p_outlet_id: args.outletId,
  });
  if (error) return { ok: false, error: error.message };
  const row = (data ?? { ok: false }) as ClaimSynckerjaCashierResult & {
    payload?: { kitchenFired?: boolean };
  };
  if (!row.ok) return row;
  return {
    ...row,
    cart_snapshot: Array.isArray(row.cart_snapshot) ? row.cart_snapshot : [],
    kitchen_fired: Boolean(row.payload?.kitchenFired),
  };
}

export async function markSynckerjaCashierKitchenFired(args: {
  pendingCheckoutId: string;
  outletId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("pos_mark_synckerja_cashier_kitchen_fired", {
    p_pending_id: args.pendingCheckoutId,
    p_outlet_id: args.outletId,
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false }) as { ok: boolean; error?: string };
}

export async function completeSynckerjaCashierCheckout(args: {
  pendingCheckoutId: string;
  sessionId: string;
  salesActivityId: string | null;
  outletId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("pos_complete_synckerja_cashier_checkout", {
    p_pending_id: args.pendingCheckoutId,
    p_session_id: args.sessionId,
    p_sales_activity_id: args.salesActivityId,
    p_outlet_id: args.outletId,
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false }) as { ok: boolean; error?: string };
}

export function resolveCashierQrClaimErrorMessage(
  error: string | undefined,
  t: (key: string, fallback: string) => string,
): string {
  if (error === "already_paid") {
    return t("posCashier.cashierQrAlreadyPaid", "This order is already paid.");
  }
  if (error === "expired") {
    return t("posCashier.cashierQrExpired", "This QR code has expired.");
  }
  if (error === "not_found") {
    return t("posCashier.cashierQrNotFound", "Order not found for this QR code.");
  }
  if (error === "not_available") {
    return t("posCashier.cashierQrNotAvailable", "This order is no longer available.");
  }
  if (error === "session_closed") {
    return t("posCashier.cashierQrSessionClosed", "This table session is already closed.");
  }
  return error ?? t("posCashier.cashierQrClaimError", "Could not load order");
}

export function claimedCashierToBillSession(
  claim: ClaimSynckerjaCashierResult,
  outletId: string,
  organizationId: string,
): PosTableSession | null {
  if (!claim.ok || !claim.session_id) return null;
  return {
    id: claim.session_id,
    organization_id: organizationId,
    outlet_id: outletId,
    group_id: claim.group_id ?? null,
    pos_table_id: claim.pos_table_id ?? null,
    table_name: claim.table_name ?? "",
    pax: claim.pax ?? 1,
    seated_at: claim.seated_at ?? new Date().toISOString(),
    closed_at: null,
    status: "open",
    opened_by: null,
    closed_by: null,
    waiter_id: null,
    sales_activity_id: null,
    cart_snapshot: claim.cart_snapshot ?? [],
    cancel_reason: null,
    customer_name: claim.customer_name ?? null,
    customer_phone: claim.customer_phone ?? null,
    created_at: claim.seated_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
