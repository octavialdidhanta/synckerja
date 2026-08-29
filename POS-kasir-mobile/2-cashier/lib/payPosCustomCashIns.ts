import { lineTotal } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { resolvePosShiftForPay } from "@/pos-mobile/4-shift/lib/usePosCashierShift";
import { supabase } from "@/shared/lib/supabaseClient";

function rpcErrorMessage(error: { message?: string } | null): string {
  const msg = error?.message ?? "";
  if (msg.includes("shift_required")) return "shift_required";
  if (msg.includes("shift_not_open")) return "shift_not_open";
  return msg || "unknown_error";
}

/**
 * Record each custom cash-receipt cart line as Cash In on the open shift.
 * Throws `shift_required` (via resolve) when no shift can be opened.
 */
export async function payPosCustomCashIns(args: {
  organizationId: string;
  outletId: string;
  customLines: CustomerVisitCartLine[];
}): Promise<void> {
  const payable = args.customLines.filter((line) => lineTotal(line) > 0);
  if (payable.length === 0) return;

  const shiftId = await resolvePosShiftForPay({
    organizationId: args.organizationId,
    outletId: args.outletId,
  });

  for (const line of payable) {
    const amount = lineTotal(line);
    const description = line.serviceName.trim() || "—";
    const { error } = await supabase.rpc("pos_add_cash_movement", {
      p_shift_id: shiftId,
      p_direction: "in",
      p_amount: amount,
      p_description: description,
    });
    if (error) throw new Error(rpcErrorMessage(error));
  }
}
