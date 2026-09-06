import type { IdentityLeadKeys, IdentityNodeId } from "./buildIdentityKeyNodes";

export type IdentityBridgeEdge = {
  leadId: string;
  a: IdentityNodeId;
  b: IdentityNodeId;
};

/** Edges only from leads that have both valid phone and email. */
export function buildIdentityBridgeEdges(leadKeys: IdentityLeadKeys[]): IdentityBridgeEdge[] {
  const edges: IdentityBridgeEdge[] = [];
  for (const row of leadKeys) {
    if (row.phoneNode && row.emailNode) {
      edges.push({ leadId: row.leadId, a: row.phoneNode, b: row.emailNode });
    }
  }
  return edges;
}
