import { supabase } from "@/shared/lib/supabaseClient";
import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import {
  rematchPosReceiptLead,
  rematchPosReceiptLeadByEmail,
} from "@/5-2-customer-visits/checkout/pos-bind";
import { isValidPosReceiptEmail } from "./isPosCustomerEmail";

export type PosDigitalReceiptChannel = "email" | "sms";

export type SendPosDigitalReceiptArgs = {
  organizationId: string;
  outletId: string;
  salesActivityId: string;
  leadId: string;
  /** May be Walk-in; sanitized before enqueue. */
  clientName?: string | null;
  channel: PosDigitalReceiptChannel;
  email?: string;
  phoneLocal?: string;
  createdByUserId?: string | null;
};

export type SendPosDigitalReceiptResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "share_disabled"
        | "invalid_email"
        | "invalid_phone"
        | "enqueue_failed"
        | "dispatch_failed";
      message: string;
    };

export { isValidPosReceiptEmail };

async function resolveServedByEmployeeId(
  organizationId: string,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("employees")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Update lead contact (+ optional personal name), enqueue invitation, dispatch edge function.
 */
export async function sendPosDigitalReceipt(
  args: SendPosDigitalReceiptArgs,
): Promise<SendPosDigitalReceiptResult> {
  const { data: settings } = await supabase
    .from("pos_outlet_receipt_settings")
    .select("share_via_email, share_via_sms")
    .eq("outlet_id", args.outletId)
    .maybeSingle();

  const shareViaEmail = Boolean(settings?.share_via_email);
  const shareViaSms = Boolean(settings?.share_via_sms);

  if (args.channel === "email" && !shareViaEmail) {
    return { ok: false, code: "share_disabled", message: "share_via_email_off" };
  }
  if (args.channel === "sms" && !shareViaSms) {
    return { ok: false, code: "share_disabled", message: "share_via_sms_off" };
  }

  const personalName = personalCustomerName(args.clientName);
  let email: string | null = null;
  let phone: string | null = null;
  /** Lead after rematch (may differ from args.leadId when rebound). */
  let resolvedLeadId = args.leadId;

  if (args.channel === "email") {
    email = (args.email ?? "").trim().toLowerCase();
    if (!isValidPosReceiptEmail(email)) {
      return { ok: false, code: "invalid_email", message: "invalid_email" };
    }
    try {
      const rematch = await rematchPosReceiptLeadByEmail({
        organizationId: args.organizationId,
        salesActivityId: args.salesActivityId,
        currentLeadId: args.leadId,
        email,
        clientName: args.clientName ?? null,
        createdBy: args.createdByUserId ?? null,
      });
      resolvedLeadId = rematch.leadId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "invalid_email") {
        return { ok: false, code: "invalid_email", message: "invalid_email" };
      }
      return { ok: false, code: "enqueue_failed", message };
    }
  } else {
    const key = normalizeCustomerVisitPhone(args.phoneLocal ?? "");
    if (!key) {
      return { ok: false, code: "invalid_phone", message: "invalid_phone" };
    }
    const digits = key.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, code: "invalid_phone", message: "invalid_phone" };
    }
    phone = key;
    try {
      const rematch = await rematchPosReceiptLead({
        organizationId: args.organizationId,
        salesActivityId: args.salesActivityId,
        currentLeadId: args.leadId,
        phoneKey: key,
        clientName: args.clientName ?? null,
        createdBy: args.createdByUserId ?? null,
      });
      resolvedLeadId = rematch.leadId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, code: "enqueue_failed", message };
    }
  }

  if (personalName) {
    const { error: saErr } = await supabase
      .from("sales_activities")
      .update({ client_name: personalName })
      .eq("id", args.salesActivityId);
    if (saErr) {
      return { ok: false, code: "enqueue_failed", message: saErr.message };
    }
    // Keep lead display name aligned after rematch (winner or current).
    const { error: leadNameErr } = await supabase
      .from("leads")
      .update({ client: personalName })
      .eq("id", resolvedLeadId);
    if (leadNameErr) {
      return { ok: false, code: "enqueue_failed", message: leadNameErr.message };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const servedByEmployeeId = await resolveServedByEmployeeId(
    args.organizationId,
    args.createdByUserId ?? user?.id ?? null,
  );

  const { data: invitationId, error } = await supabase.rpc(
    "enqueue_pos_receipt_feedback_invitation",
    {
      p_organization_id: args.organizationId,
      p_sales_activity_id: args.salesActivityId,
      p_pos_outlet_id: args.outletId,
      p_served_by_employee_id: servedByEmployeeId,
      p_customer_email: email,
      p_customer_phone: phone,
      p_customer_name: personalName,
      p_share_via_email: args.channel === "email",
      p_share_via_sms: args.channel === "sms",
    },
  );

  if (error || !invitationId) {
    return {
      ok: false,
      code: "enqueue_failed",
      message: error?.message ?? "enqueue_failed",
    };
  }

  const { data: dispatchData, error: dispatchErr } = await supabase.functions.invoke(
    "dispatch-pos-receipt-feedback",
    { body: { invitationId: String(invitationId) } },
  );
  if (dispatchErr) {
    return {
      ok: false,
      code: "dispatch_failed",
      message: dispatchErr.message,
    };
  }
  if (
    dispatchData &&
    typeof dispatchData === "object" &&
    "success" in dispatchData &&
    (dispatchData as { success?: unknown }).success === false
  ) {
    const errors = (dispatchData as { errors?: unknown }).errors;
    const message = Array.isArray(errors)
      ? errors.map(String).join("; ")
      : "dispatch_failed";
    return { ok: false, code: "dispatch_failed", message };
  }

  return { ok: true };
}
