import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import { normalizeCustomerEmail } from "@/5-2-customer-visits/lib/normalizeCustomerEmail";
import { invokeCheckoutIdentityBridgeExecute } from "@/5-2-customer-visits/leads-identity-merge/bridge/invokeCheckoutIdentityBridgeExecute";
import {
  lookupPosCheckoutLeadByEmail,
  lookupPosCheckoutLeadByPhone,
} from "./lookupPosCheckoutLead";
import { attachPosCheckoutContactIfEmpty } from "./attachPosCheckoutContactIfEmpty";
import {
  isPosCheckoutPhoneExistsError,
  resolvePosCheckoutClientPatch,
  resolvePosCheckoutInsertClient,
} from "./posCheckoutLeadGuards";
import { POS_CHECKOUT_WALK_IN_CLIENT } from "./posCheckoutLead.types";
import type {
  EnsurePosCheckoutLeadInput,
  EnsurePosCheckoutLeadResult,
  PosCheckoutLeadWritePlan,
} from "./posCheckoutLead.types";

const ANON_CREATED_BY = "00000000-0000-0000-0000-000000000000";

export function planPosCheckoutLeadWrite(args: {
  phoneKey: string | null;
  emailKey: string | null;
  requestedName: string | null;
  existingPhoneId: string | null;
  existingPhoneClient: string | null;
  existingEmailId: string | null;
  existingEmailClient: string | null;
}): PosCheckoutLeadWritePlan {
  const client = resolvePosCheckoutInsertClient(args.requestedName);

  if (
    args.phoneKey &&
    args.emailKey &&
    args.existingPhoneId &&
    args.existingEmailId &&
    args.existingPhoneId !== args.existingEmailId
  ) {
    return {
      action: "bridge_merge",
      phoneLeadId: args.existingPhoneId,
      emailLeadId: args.existingEmailId,
      phoneKey: args.phoneKey,
      emailKey: args.emailKey,
      boundByPhone: true,
      boundByEmail: true,
    };
  }

  if (args.phoneKey && args.existingPhoneId) {
    return {
      action: "reuse",
      leadId: args.existingPhoneId,
      phoneKey: args.phoneKey,
      emailKey: args.emailKey,
      clientPatch: resolvePosCheckoutClientPatch(
        args.existingPhoneClient,
        args.requestedName,
      ),
      boundByPhone: true,
      boundByEmail: false,
    };
  }

  if (args.emailKey && args.existingEmailId) {
    return {
      action: "reuse_email",
      leadId: args.existingEmailId,
      emailKey: args.emailKey,
      phoneKey: args.phoneKey,
      clientPatch: resolvePosCheckoutClientPatch(
        args.existingEmailClient,
        args.requestedName,
      ),
      boundByPhone: false,
      boundByEmail: true,
    };
  }

  if (args.phoneKey) {
    return {
      action: "insert_with_phone",
      phoneKey: args.phoneKey,
      emailKey: args.emailKey,
      client,
      boundByPhone: true,
      boundByEmail: false,
    };
  }

  return {
    action: "insert_walkin",
    client,
    emailKey: args.emailKey,
    boundByPhone: false,
    boundByEmail: false,
  };
}

async function resolveDefaultLeadStatusId(organizationId: string): Promise<string | null> {
  const { data } = await supabase
    .from("lead_statuses")
    .select("id")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("sort_order", { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? null;
}

async function insertPosWalkInLead(args: {
  organizationId: string;
  client: string;
  phoneKey: string | null;
  emailKey: string | null;
  userId: string | null;
}): Promise<string> {
  const statusId = await resolveDefaultLeadStatusId(args.organizationId);
  const row: Record<string, unknown> = {
    ticket_id: `pos-walkin-${crypto.randomUUID()}`,
    client: args.client.trim() || POS_CHECKOUT_WALK_IN_CLIENT,
    title: "POS Walk-in",
    category: "POS",
    created_by: args.userId ?? ANON_CREATED_BY,
    created_by_name: "Synckerja POS",
    assignee: "",
    status_id: statusId,
    organization_id: args.organizationId,
    source: "POS",
    followup: 0,
  };
  if (args.phoneKey) row.phone_number = args.phoneKey;
  if (args.emailKey) row.email = args.emailKey;

  const { data, error } = await supabase.from("leads").insert(row).select("id").single();
  if (error) throw error;
  if (!data?.id) throw new Error("pos_cashier_lead_create_failed");
  return data.id as string;
}

function resultFlags(partial: {
  leadId: string;
  boundByPhone: boolean;
  boundByEmail: boolean;
  created: boolean;
}): EnsurePosCheckoutLeadResult {
  return partial;
}

async function reuseExistingByPhone(args: {
  organizationId: string;
  rawPhone: string | null | undefined;
}): Promise<EnsurePosCheckoutLeadResult | null> {
  const found = await lookupPosCheckoutLeadByPhone({
    organizationId: args.organizationId,
    rawPhone: args.rawPhone,
  });
  if (!found?.lead) return null;
  return resultFlags({
    leadId: found.lead.id,
    boundByPhone: true,
    boundByEmail: Boolean(normalizeCustomerEmail(found.lead.email)),
    created: false,
  });
}

export async function ensurePosCheckoutLead(
  input: EnsurePosCheckoutLeadInput,
): Promise<EnsurePosCheckoutLeadResult> {
  const phoneKey = normalizeCustomerVisitPhone(input.phone);
  const emailKey = normalizeCustomerEmail(input.email);

  const foundPhone = phoneKey
    ? await lookupPosCheckoutLeadByPhone({
        organizationId: input.organizationId,
        rawPhone: input.phone,
      })
    : null;

  const foundEmail = emailKey
    ? await lookupPosCheckoutLeadByEmail({
        organizationId: input.organizationId,
        rawEmail: emailKey,
      })
    : null;

  const plan = planPosCheckoutLeadWrite({
    phoneKey,
    emailKey,
    requestedName: input.clientName ?? null,
    existingPhoneId: foundPhone?.lead?.id ?? null,
    existingPhoneClient: foundPhone?.lead?.client ?? null,
    existingEmailId: foundEmail?.lead?.id ?? null,
    existingEmailClient: foundEmail?.lead?.client ?? null,
  });

  if (plan.action === "bridge_merge") {
    const bridge = await invokeCheckoutIdentityBridgeExecute({
      organizationId: input.organizationId,
      phoneLeadId: plan.phoneLeadId,
      emailLeadId: plan.emailLeadId,
      confirm: true,
    });
    if (bridge.skipped || !bridge.winner_lead_id) {
      // Unsafe / skipped: keep phone lead, do not attach conflicting email.
      const patch: Record<string, string> = { phone_number: plan.phoneKey };
      const { error } = await supabase.from("leads").update(patch).eq("id", plan.phoneLeadId);
      if (error) throw error;
      return resultFlags({
        leadId: plan.phoneLeadId,
        boundByPhone: true,
        boundByEmail: false,
        created: false,
      });
    }
    return resultFlags({
      leadId: bridge.winner_lead_id,
      boundByPhone: true,
      boundByEmail: true,
      created: false,
    });
  }

  if (plan.action === "reuse") {
    const contact = attachPosCheckoutContactIfEmpty({
      existingPhone: foundPhone?.lead?.phone_number,
      existingEmail: foundPhone?.lead?.email,
      phoneKey: null,
      emailKey: plan.emailKey,
    });
    const patch: Record<string, string> = { phone_number: plan.phoneKey };
    if (plan.clientPatch) patch.client = plan.clientPatch;
    if (contact.email) patch.email = contact.email;
    const { error } = await supabase.from("leads").update(patch).eq("id", plan.leadId);
    if (error) {
      if (isPosCheckoutPhoneExistsError(error)) {
        const reused = await reuseExistingByPhone({
          organizationId: input.organizationId,
          rawPhone: plan.phoneKey,
        });
        if (reused) return reused;
      }
      throw error;
    }
    return resultFlags({
      leadId: plan.leadId,
      boundByPhone: true,
      boundByEmail: Boolean(contact.email || normalizeCustomerEmail(foundPhone?.lead?.email)),
      created: false,
    });
  }

  if (plan.action === "reuse_email") {
    const contact = attachPosCheckoutContactIfEmpty({
      existingPhone: foundEmail?.lead?.phone_number,
      existingEmail: foundEmail?.lead?.email,
      phoneKey: plan.phoneKey,
      emailKey: null,
    });
    const patch: Record<string, string> = { email: plan.emailKey };
    if (plan.clientPatch) patch.client = plan.clientPatch;
    if (contact.phone_number) patch.phone_number = contact.phone_number;
    const { error } = await supabase.from("leads").update(patch).eq("id", plan.leadId);
    if (error) throw error;
    return resultFlags({
      leadId: plan.leadId,
      boundByPhone: Boolean(contact.phone_number || normalizeCustomerVisitPhone(foundEmail?.lead?.phone_number)),
      boundByEmail: true,
      created: false,
    });
  }

  try {
    const leadId = await insertPosWalkInLead({
      organizationId: input.organizationId,
      client: plan.client,
      phoneKey: plan.action === "insert_with_phone" ? plan.phoneKey : null,
      emailKey: plan.emailKey,
      userId: input.userId ?? null,
    });
    return resultFlags({
      leadId,
      boundByPhone: plan.boundByPhone,
      boundByEmail: Boolean(plan.emailKey),
      created: true,
    });
  } catch (err) {
    const error = err as { message?: string; code?: string } | null;
    if (plan.action === "insert_with_phone" && isPosCheckoutPhoneExistsError(error)) {
      const reused = await reuseExistingByPhone({
        organizationId: input.organizationId,
        rawPhone: plan.phoneKey,
      });
      if (reused) return reused;
    }
    throw err;
  }
}
