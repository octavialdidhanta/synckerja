import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { supabase } from "@/shared/lib/supabaseClient";
import { lookupPosCheckoutLeadByPhone } from "./lookupPosCheckoutLead";
import { recordPosPaidCustomerVisit } from "./recordPosPaidCustomerVisit";
import type {
  PosCheckoutLeadRow,
  PosReceiptRematchPlan,
  RematchPosReceiptLeadInput,
  RematchPosReceiptLeadResult,
} from "./posCheckoutLead.types";

export function planPosReceiptRematch(args: {
  currentLeadId: string;
  picked: PosCheckoutLeadRow | null;
  phoneKey: string;
  requestedName: string | null;
}): PosReceiptRematchPlan {
  const personalName = personalCustomerName(args.requestedName);
  if (args.picked && args.picked.id !== args.currentLeadId) {
    return {
      action: "rebind",
      winnerLeadId: args.picked.id,
      personalName: personalCustomerName(args.picked.client) ?? personalName,
      writePhoneOnCurrent: false,
    };
  }
  return {
    action: "update_current",
    phoneKey: args.phoneKey,
    personalName,
    writePhoneOnCurrent: true,
  };
}

/**
 * After pay, SMS may add a phone that already belongs to a Magnet lead.
 * Rebind the receipt pointer; never copy that number onto the Walk-in row.
 */
export async function rematchPosReceiptLead(
  input: RematchPosReceiptLeadInput,
): Promise<RematchPosReceiptLeadResult> {
  const found = await lookupPosCheckoutLeadByPhone({
    organizationId: input.organizationId,
    rawPhone: input.phoneKey,
  });
  const phoneKey = found?.phoneKey ?? input.phoneKey;
  const plan = planPosReceiptRematch({
    currentLeadId: input.currentLeadId,
    picked: found?.lead ?? null,
    phoneKey,
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

    const visit = await recordPosPaidCustomerVisit({
      organizationId: input.organizationId,
      leadId: plan.winnerLeadId,
      salesActivityId: input.salesActivityId,
      phoneKey,
      lookupRaw: input.phoneKey,
      createdBy: input.createdBy ?? null,
      boundByPhone: true,
    });

    return {
      leadId: plan.winnerLeadId,
      rebound: true,
      visitId: visit?.visitId ?? null,
    };
  }

  const leadPatch: Record<string, string> = { phone_number: plan.phoneKey };
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

  const visit = await recordPosPaidCustomerVisit({
    organizationId: input.organizationId,
    leadId: input.currentLeadId,
    salesActivityId: input.salesActivityId,
    phoneKey: plan.phoneKey,
    lookupRaw: input.phoneKey,
    createdBy: input.createdBy ?? null,
    boundByPhone: true,
  });

  return {
    leadId: input.currentLeadId,
    rebound: false,
    visitId: visit?.visitId ?? null,
  };
}
