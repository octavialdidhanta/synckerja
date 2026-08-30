import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import { lookupPosCheckoutLeadByPhone } from "./lookupPosCheckoutLead";
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
  requestedName: string | null;
  existingId: string | null;
  existingClient: string | null;
}): PosCheckoutLeadWritePlan {
  const client = resolvePosCheckoutInsertClient(args.requestedName);
  if (!args.phoneKey) {
    return { action: "insert_walkin", client, boundByPhone: false };
  }
  if (args.existingId) {
    return {
      action: "reuse",
      leadId: args.existingId,
      phoneKey: args.phoneKey,
      clientPatch: resolvePosCheckoutClientPatch(args.existingClient, args.requestedName),
      boundByPhone: true,
    };
  }
  return {
    action: "insert_with_phone",
    phoneKey: args.phoneKey,
    client,
    boundByPhone: true,
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

  const { data, error } = await supabase.from("leads").insert(row).select("id").single();
  if (error) throw error;
  if (!data?.id) throw new Error("pos_cashier_lead_create_failed");
  return data.id as string;
}

async function reuseExistingLead(args: {
  organizationId: string;
  rawPhone: string | null | undefined;
}): Promise<EnsurePosCheckoutLeadResult | null> {
  const found = await lookupPosCheckoutLeadByPhone({
    organizationId: args.organizationId,
    rawPhone: args.rawPhone,
  });
  if (!found?.lead) return null;
  return { leadId: found.lead.id, boundByPhone: true, created: false };
}

export async function ensurePosCheckoutLead(
  input: EnsurePosCheckoutLeadInput,
): Promise<EnsurePosCheckoutLeadResult> {
  const phoneKey = normalizeCustomerVisitPhone(input.phone);
  const found = phoneKey
    ? await lookupPosCheckoutLeadByPhone({
        organizationId: input.organizationId,
        rawPhone: input.phone,
      })
    : null;

  const plan = planPosCheckoutLeadWrite({
    phoneKey,
    requestedName: input.clientName ?? null,
    existingId: found?.lead?.id ?? null,
    existingClient: found?.lead?.client ?? null,
  });

  if (plan.action === "reuse") {
    const patch: Record<string, string> = { phone_number: plan.phoneKey };
    if (plan.clientPatch) patch.client = plan.clientPatch;
    const { error } = await supabase.from("leads").update(patch).eq("id", plan.leadId);
    if (error) {
      if (isPosCheckoutPhoneExistsError(error)) {
        const reused = await reuseExistingLead({
          organizationId: input.organizationId,
          rawPhone: plan.phoneKey,
        });
        if (reused) return reused;
      }
      throw error;
    }
    return { leadId: plan.leadId, boundByPhone: true, created: false };
  }

  try {
    const leadId = await insertPosWalkInLead({
      organizationId: input.organizationId,
      client: plan.client,
      phoneKey: plan.action === "insert_with_phone" ? plan.phoneKey : null,
      userId: input.userId ?? null,
    });
    return {
      leadId,
      boundByPhone: plan.boundByPhone,
      created: true,
    };
  } catch (err) {
    const error = err as { message?: string; code?: string } | null;
    if (plan.action === "insert_with_phone" && isPosCheckoutPhoneExistsError(error)) {
      const reused = await reuseExistingLead({
        organizationId: input.organizationId,
        rawPhone: plan.phoneKey,
      });
      if (reused) return reused;
    }
    throw err;
  }
}
