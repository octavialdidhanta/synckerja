import { isAttributedPosCheckoutLead } from "@/5-2-customer-visits/checkout/pos-bind/posCheckoutLeadGuards";
import { pickPosCheckoutLead } from "@/5-2-customer-visits/checkout/pos-bind/pickPosCheckoutLead";
import type { PosCheckoutLeadRow } from "@/5-2-customer-visits/checkout/pos-bind/posCheckoutLead.types";
import type {
  LeadMergeCluster,
  LeadMergeClusterPlan,
  LeadMergeLeadInput,
} from "./types";

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

/**
 * Mirror SQL `_lead_merge_pick_winner` / dry_run skip for ambiguous attributed.
 */
export function planLeadMergeCluster(
  cluster: LeadMergeCluster,
  leadsById: Map<string, LeadMergeLeadInput>,
  enrolledLeadIds: ReadonlySet<string> = new Set(),
): LeadMergeClusterPlan {
  const members = cluster.leadIds
    .map((id) => leadsById.get(id))
    .filter((lead): lead is LeadMergeLeadInput => Boolean(lead && !lead.merged_into_lead_id));

  const leadIds = members.map((m) => m.id);
  const attributedCount = members.filter((m) =>
    isAttributedPosCheckoutLead(
      { id: m.id, source: m.source, ticket_id: m.ticket_id },
      enrolledLeadIds,
    ),
  ).length;

  if (attributedCount > 1) {
    return {
      kind: cluster.kind,
      clusterKey: cluster.clusterKey,
      leadIds,
      skipped: true,
      skipReason: "ambiguous_attributed",
      winnerLeadId: null,
      loserLeadIds: [],
    };
  }

  const winner = pickPosCheckoutLead(
    members.map(toPosRow),
    enrolledLeadIds,
  );
  if (!winner) {
    return {
      kind: cluster.kind,
      clusterKey: cluster.clusterKey,
      leadIds,
      skipped: true,
      skipReason: "ambiguous_attributed",
      winnerLeadId: null,
      loserLeadIds: [],
    };
  }

  return {
    kind: cluster.kind,
    clusterKey: cluster.clusterKey,
    leadIds,
    skipped: false,
    skipReason: null,
    winnerLeadId: winner.id,
    loserLeadIds: leadIds.filter((id) => id !== winner.id),
  };
}
