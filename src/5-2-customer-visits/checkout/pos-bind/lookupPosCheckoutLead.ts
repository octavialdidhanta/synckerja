import { supabase } from "@/shared/lib/supabaseClient";
import {
  customerVisitPhoneLookupVariants,
  normalizeCustomerVisitPhone,
} from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import { normalizeCustomerEmail } from "@/5-2-customer-visits/lib/normalizeCustomerEmail";
import { pickPosCheckoutLead } from "./pickPosCheckoutLead";
import type { PosCheckoutLeadRow } from "./posCheckoutLead.types";

export const POS_CHECKOUT_LEAD_SELECT =
  "id, client, phone_number, email, source, ticket_id, updated_at, created_at";

function mapLeadRow(row: Record<string, unknown>): PosCheckoutLeadRow {
  return {
    id: String(row.id),
    client: String(row.client ?? ""),
    phone_number: row.phone_number == null ? null : String(row.phone_number),
    email: row.email == null ? null : String(row.email),
    source: row.source == null ? null : String(row.source),
    ticket_id: String(row.ticket_id ?? ""),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
    created_at: row.created_at == null ? null : String(row.created_at),
  };
}

export async function fetchPosCheckoutLeadsByPhone(args: {
  organizationId: string;
  phoneKey: string;
}): Promise<PosCheckoutLeadRow[]> {
  const variants = customerVisitPhoneLookupVariants(args.phoneKey);
  const { data, error } = await supabase
    .from("leads")
    .select(POS_CHECKOUT_LEAD_SELECT)
    .eq("organization_id", args.organizationId)
    .is("merged_into_lead_id", null)
    .in("phone_number", variants);
  if (error) throw error;
  return (data ?? []).map((row) => mapLeadRow(row as Record<string, unknown>));
}

export async function fetchPosCheckoutLeadsByEmail(args: {
  organizationId: string;
  emailKey: string;
}): Promise<PosCheckoutLeadRow[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(POS_CHECKOUT_LEAD_SELECT)
    .eq("organization_id", args.organizationId)
    .is("merged_into_lead_id", null)
    .eq("email", args.emailKey);
  if (error) throw error;
  return (data ?? []).map((row) => mapLeadRow(row as Record<string, unknown>));
}

export async function fetchEnrolledLeadIds(args: {
  organizationId: string;
  leadIds: string[];
}): Promise<Set<string>> {
  if (args.leadIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("lead_magnet_enrollments")
    .select("lead_id")
    .eq("organization_id", args.organizationId)
    .in("lead_id", args.leadIds)
    .not("lead_id", "is", null);
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = String((row as { lead_id?: string | null }).lead_id ?? "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

export async function lookupPosCheckoutLeadByPhone(args: {
  organizationId: string;
  rawPhone: string | null | undefined;
}): Promise<{ phoneKey: string; lead: PosCheckoutLeadRow | null } | null> {
  const phoneKey = normalizeCustomerVisitPhone(args.rawPhone);
  if (!phoneKey) return null;
  const leads = await fetchPosCheckoutLeadsByPhone({
    organizationId: args.organizationId,
    phoneKey,
  });
  if (leads.length === 0) return { phoneKey, lead: null };
  const enrolled = await fetchEnrolledLeadIds({
    organizationId: args.organizationId,
    leadIds: leads.map((lead) => lead.id),
  });
  return { phoneKey, lead: pickPosCheckoutLead(leads, enrolled) };
}

export async function lookupPosCheckoutLeadByEmail(args: {
  organizationId: string;
  rawEmail: string | null | undefined;
}): Promise<{ emailKey: string; lead: PosCheckoutLeadRow | null } | null> {
  const emailKey = normalizeCustomerEmail(args.rawEmail);
  if (!emailKey) return null;
  const leads = await fetchPosCheckoutLeadsByEmail({
    organizationId: args.organizationId,
    emailKey,
  });
  if (leads.length === 0) return { emailKey, lead: null };
  const enrolled = await fetchEnrolledLeadIds({
    organizationId: args.organizationId,
    leadIds: leads.map((lead) => lead.id),
  });
  return { emailKey, lead: pickPosCheckoutLead(leads, enrolled) };
}
