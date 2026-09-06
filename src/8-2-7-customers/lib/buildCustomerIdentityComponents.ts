import type { CustomerClvLeadInput } from "./groupCustomerClv";
import { buildIdentityLeadKeys } from "@/5-2-customer-visits/leads-identity-merge/graph/buildIdentityKeyNodes";
import { buildIdentityBridgeEdges } from "@/5-2-customer-visits/leads-identity-merge/graph/buildIdentityBridgeEdges";
import {
  unionIdentityComponents,
  type IdentityComponent,
} from "@/5-2-customer-visits/leads-identity-merge/graph/unionIdentityComponents";
import type { LeadMergeLeadInput } from "@/5-2-customer-visits/leads-identity-merge/types";

function toMergeLead(lead: CustomerClvLeadInput): LeadMergeLeadInput {
  return {
    id: lead.id,
    client: lead.client,
    phone_number: lead.phone_number,
    email: lead.email,
    source: null,
    ticket_id: "",
    updated_at: lead.updated_at ?? null,
    created_at: lead.created_at ?? null,
    merged_into_lead_id: null,
  };
}

/**
 * Build identity components for CLV (strict bridges: phone+email on same lead).
 */
export function buildCustomerIdentityComponents(
  leads: CustomerClvLeadInput[],
): IdentityComponent[] {
  const keys = buildIdentityLeadKeys(leads.map(toMergeLead));
  return unionIdentityComponents(keys, buildIdentityBridgeEdges(keys));
}

/** Map leadId → componentId for active identity leads. */
export function mapLeadIdToIdentityComponent(
  leads: CustomerClvLeadInput[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of buildCustomerIdentityComponents(leads)) {
    for (const id of c.leadIds) map.set(id, c.componentId);
  }
  return map;
}
