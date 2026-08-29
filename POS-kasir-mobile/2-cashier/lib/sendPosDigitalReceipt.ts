import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

  if (args.channel === "email") {
    email = (args.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return { ok: false, code: "invalid_email", message: "invalid_email" };
    }
    const leadPatch: Record<string, string> = { email };
    if (personalName) leadPatch.client = personalName;
    const { error: leadErr } = await supabase
      .from("leads")
      .update(leadPatch)
      .eq("id", args.leadId);
    if (leadErr) {
      return { ok: false, code: "enqueue_failed", message: leadErr.message };
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
    const leadPatch: Record<string, string> = { phone_number: phone };
    if (personalName) leadPatch.client = personalName;
    const { error: leadErr } = await supabase
      .from("leads")
      .update(leadPatch)
      .eq("id", args.leadId);
    if (leadErr) {
      return { ok: false, code: "enqueue_failed", message: leadErr.message };
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

  const { error: dispatchErr } = await supabase.functions.invoke(
    "dispatch-pos-receipt-feedback",
    { body: { invitationId } },
  );
  if (dispatchErr) {
    return {
      ok: false,
      code: "dispatch_failed",
      message: dispatchErr.message,
    };
  }

  return { ok: true };
}
