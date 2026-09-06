import { isAttributedPosCheckoutLead } from "@/5-2-customer-visits/checkout/pos-bind/posCheckoutLeadGuards";
import { pickPosCheckoutLead } from "@/5-2-customer-visits/checkout/pos-bind/pickPosCheckoutLead";
import type { PosCheckoutLeadRow } from "@/5-2-customer-visits/checkout/pos-bind/posCheckoutLead.types";
import type { LeadMergeLeadInput } from "../types";
import type { IdentityComponent } from "./unionIdentityComponents";

export type IdentityComponentMergePlan =
  | {
      componentId: string;
      leadIds: string[];
      skipped: false;
      skipReason: null;
      winnerLeadId: string;
      loserLeadIds: string[];
    }
  | {
      componentId: string;
      leadIds: string[];
      skipped: true;
      skipReason: "ambiguous_attributed" | "singleton";
      winnerLeadId: null;
      loserLeadIds: [];
    };

function toPosRow(lead: LeadMergeLeadInput): PosCheckoutLeadRow {
  return {
    id: lead.id,
    client: lead.client ?? "",
    phone_number: lead.phone_number,
    email: lead.email,
    source: lead.source,
    ticket_id: lead.ticket_id ?? "",
    updated_at: lead.updated_at,
    created_at: lead.created_at,
  };
}

export function planIdentityComponentMerge(
  component: IdentityComponent,
  leadsById: Map<string, LeadMergeLeadInput>,
  enrolledLeadIds: ReadonlySet<string> = new Set(),
): IdentityComponentMergePlan {
  const members = component.leadIds
    .map((id) => leadsById.get(id))
    .filter((l): l is LeadMergeLeadInput => Boolean(l && !l.merged_into_lead_id));
  const leadIds = members.map((m) => m.id);

  if (leadIds.length < 2) {
    return {
      componentId: component.componentId,
      leadIds,
      skipped: true,
      skipReason: "singleton",
      winnerLeadId: null,
      loserLeadIds: [],
    };
  }

  const attributedCount = members.filter((m) =>
    isAttributedPosCheckoutLead(
      { id: m.id, source: m.source, ticket_id: m.ticket_id },
      enrolledLeadIds,
    ),
  ).length;

  if (attributedCount > 1) {
    return {
      componentId: component.componentId,
      leadIds,
      skipped: true,
      skipReason: "ambiguous_attributed",
      winnerLeadId: null,
      loserLeadIds: [],
    };
  }

  const winner = pickPosCheckoutLead(members.map(toPosRow), enrolledLeadIds);
  if (!winner) {
    return {
      componentId: component.componentId,
      leadIds,
      skipped: true,
      skipReason: "ambiguous_attributed",
      winnerLeadId: null,
      loserLeadIds: [],
    };
  }

  return {
    componentId: component.componentId,
    leadIds,
    skipped: false,
    skipReason: null,
    winnerLeadId: winner.id,
    loserLeadIds: leadIds.filter((id) => id !== winner.id),
  };
}
