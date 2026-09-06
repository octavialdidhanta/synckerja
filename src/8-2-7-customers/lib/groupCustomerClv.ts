import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import {
  resolveCustomerSince,
  type CustomerSpendTotals,
} from "./aggregateCustomerSpend";
import { resolveCustomerIdentityKey } from "./customerIdentityKey";
import { mapLeadIdToIdentityComponent } from "./buildCustomerIdentityComponents";
import { normalizeCustomerEmail } from "./normalizeCustomerEmail";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import type { CustomerListRow } from "../types";

export type CustomerClvLeadInput = {
  id: string;
  client: string;
  email: string | null;
  phone_number: string | null;
  converted_at: string | null;
  created_at: string;
  /** ISO or sortable timestamp for picking newest personal name. */
  updated_at?: string | null;
};

type GroupAccumulator = {
  id: string;
  phoneKey: string | null;
  emailKey: string | null;
  thisMonth: number;
  thisYear: number;
  lifetime: number;
  customerSince: string | null;
  /** Personal name candidates: prefer newest updated_at. */
  nameCandidates: Array<{ name: string; updatedAt: string }>;
};

function emptySpend(): CustomerSpendTotals {
  return {
    thisMonth: 0,
    thisYear: 0,
    lifetime: 0,
    firstPurchaseDate: null,
  };
}

function minYmd(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function pickDisplayName(candidates: GroupAccumulator["nameCandidates"]): string {
  if (candidates.length === 0) return "Walk-in";
  const sorted = [...candidates].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  return sorted[0]?.name ?? "Walk-in";
}

/**
 * Build CLV list rows: exclude leads without phone/email; group by identity
 * component (union-find via leads that have both phone+email as bridges).
 * Spend maps are keyed by lead_id (from aggregateCustomerSpend).
 */
export function groupCustomerClv(
  leads: CustomerClvLeadInput[],
  spendByLead: Map<string, CustomerSpendTotals>,
  leadIdsWithPaid: Set<string>,
): CustomerListRow[] {
  const customerLeads = leads.filter(
    (lead) => Boolean(lead.converted_at) || leadIdsWithPaid.has(lead.id),
  );
  const leadToComponent = mapLeadIdToIdentityComponent(customerLeads);
  const groups = new Map<string, GroupAccumulator>();

  for (const lead of customerLeads) {
    const identity = resolveCustomerIdentityKey({
      phone: lead.phone_number,
      email: lead.email,
    });
    if (!identity) continue;

    const componentId = leadToComponent.get(lead.id) ?? identity.id;
    const spend = spendByLead.get(lead.id) ?? emptySpend();
    const since = resolveCustomerSince({
      convertedAt: lead.converted_at,
      createdAt: lead.created_at,
      firstPurchaseDate: spend.firstPurchaseDate,
    });

    const phoneFromLead = normalizeCustomerVisitPhone(lead.phone_number);
    const emailFromLead = normalizeCustomerEmail(lead.email);
    let group = groups.get(componentId);
    if (!group) {
      group = {
        id: componentId,
        phoneKey: phoneFromLead,
        emailKey: emailFromLead,
        thisMonth: 0,
        thisYear: 0,
        lifetime: 0,
        customerSince: null,
        nameCandidates: [],
      };
      groups.set(componentId, group);
    }

    group.thisMonth += spend.thisMonth;
    group.thisYear += spend.thisYear;
    group.lifetime += spend.lifetime;
    group.customerSince = minYmd(group.customerSince, since);

    if (phoneFromLead) group.phoneKey = phoneFromLead;
    if (emailFromLead) group.emailKey = emailFromLead;

    const personal = personalCustomerName(lead.client);
    if (personal) {
      group.nameCandidates.push({
        name: personal,
        updatedAt: lead.updated_at ?? lead.created_at ?? "",
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      id: group.id,
      name: pickDisplayName(group.nameCandidates),
      phone: group.phoneKey,
      email: group.emailKey,
      customerSince: group.customerSince,
      thisMonth: group.thisMonth,
      thisYear: group.thisYear,
      lifetime: group.lifetime,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
