import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import { normalizeCustomerEmail } from "@/5-2-customer-visits/lib/normalizeCustomerEmail";
import { supabase } from "@/shared/lib/supabaseClient";
import { lookupPosCheckoutLeadByEmail } from "./lookupPosCheckoutLead";
import { recordPosPaidCustomerVisit } from "./recordPosPaidCustomerVisit";
import type {
  PosCheckoutLeadRow,
  PosReceiptEmailRematchPlan,
  RematchPosReceiptLeadByEmailInput,
  RematchPosReceiptLeadResult,
} from "./posCheckoutLead.types";

export function planPosReceiptEmailRematch(args: {
  currentLeadId: string;
  picked: PosCheckoutLeadRow | null;
  emailKey: string;
  requestedName: string | null;
}): PosReceiptEmailRematchPlan {
  const personalName = personalCustomerName(args.requestedName);
  if (args.picked && args.picked.id !== args.currentLeadId) {
    return {
      action: "rebind",
      winnerLeadId: args.picked.id,
      personalName: personalCustomerName(args.picked.client) ?? personalName,
      writeEmailOnCurrent: false,
    };
  }
  return {
    action: "update_current",
    emailKey: args.emailKey,
    personalName,
    writeEmailOnCurrent: true,
  };
}

/**
 * After pay, email receipt may target an address that already belongs to another lead.
 * Rebind the receipt pointer; never copy that email onto the Walk-in row.
 */
export async function rematchPosReceiptLeadByEmail(
  input: RematchPosReceiptLeadByEmailInput,
): Promise<RematchPosReceiptLeadResult> {
  const emailKey = normalizeCustomerEmail(input.email);
  if (!emailKey) {
    throw new Error("invalid_email");
  }

  const found = await lookupPosCheckoutLeadByEmail({
    organizationId: input.organizationId,
    rawEmail: emailKey,
  });
  const plan = planPosReceiptEmailRematch({
    currentLeadId: input.currentLeadId,
    picked: found?.lead ?? null,
    emailKey,
    requestedName: input.clientName ?? null,
  });

  if (plan.action === "rebind") {
    const activityPatch: Record<string, string | null> = { lead_id: plan.winnerLeadId };
    if (plan.personalName) activityPatch.client_name = plan.personalName;
    const { error } = await supabase
      .from("sales_activities")
      .update(activityPatch)
      .eq("id", input.salesActivityId)
      .eq("organization_id", input.organizationId);
    if (error) throw error;

    // Ensure winner has the email if missing
    const { data: winner } = await supabase
      .from("leads")
      .select("id, email, phone_number, client")
      .eq("id", plan.winnerLeadId)
      .maybeSingle();

    if (winner && !normalizeCustomerEmail(winner.email as string | null)) {
      await supabase.from("leads").update({ email: emailKey }).eq("id", plan.winnerLeadId);
    }
    if (plan.personalName && winner && !personalCustomerName(winner.client as string | null)) {
      await supabase
        .from("leads")
        .update({ client: plan.personalName })
        .eq("id", plan.winnerLeadId);
    }

    const phoneKey = normalizeCustomerVisitPhone(
      (winner?.phone_number as string | null | undefined) ?? null,
    );
    let visitId: string | null = null;
    if (phoneKey) {
      const visit = await recordPosPaidCustomerVisit({
        organizationId: input.organizationId,
        leadId: plan.winnerLeadId,
        salesActivityId: input.salesActivityId,
        phoneKey,
        lookupRaw: phoneKey,
        createdBy: input.createdBy ?? null,
        boundByPhone: true,
      });
      visitId = visit?.visitId ?? null;
    }

    return {
      leadId: plan.winnerLeadId,
      rebound: true,
      visitId,
    };
  }

  const leadPatch: Record<string, string> = { email: plan.emailKey };
  if (plan.personalName) leadPatch.client = plan.personalName;
  const { error: leadErr } = await supabase
    .from("leads")
    .update(leadPatch)
    .eq("id", input.currentLeadId);
  if (leadErr) throw leadErr;

  if (plan.personalName) {
    const { error: saErr } = await supabase
      .from("sales_activities")
      .update({ client_name: plan.personalName })
      .eq("id", input.salesActivityId);
    if (saErr) throw saErr;
  }

  const { data: current } = await supabase
    .from("leads")
    .select("phone_number")
    .eq("id", input.currentLeadId)
    .maybeSingle();
  const phoneKey = normalizeCustomerVisitPhone(
    (current?.phone_number as string | null | undefined) ?? null,
  );
  let visitId: string | null = null;
  if (phoneKey) {
    const visit = await recordPosPaidCustomerVisit({
      organizationId: input.organizationId,
      leadId: input.currentLeadId,
      salesActivityId: input.salesActivityId,
      phoneKey,
      lookupRaw: phoneKey,
      createdBy: input.createdBy ?? null,
      boundByPhone: true,
    });
    visitId = visit?.visitId ?? null;
  }

  return {
    leadId: input.currentLeadId,
    rebound: false,
    visitId,
  };
}
