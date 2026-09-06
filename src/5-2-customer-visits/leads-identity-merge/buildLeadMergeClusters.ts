import { normalizeMergeEmailKey } from "./normalizeMergeEmailKey";
import { normalizeMergePhoneKey } from "./normalizeMergePhoneKey";
import type { LeadMergeCluster, LeadMergeLeadInput } from "./types";

function isActiveLead(lead: LeadMergeLeadInput): boolean {
  return !lead.merged_into_lead_id;
}

/**
 * Build phone then email clusters (size >= 2). No phone↔email union.
 * Active leads only (`merged_into_lead_id` null/absent).
 */
export function buildLeadMergeClusters(leads: LeadMergeLeadInput[]): LeadMergeCluster[] {
  const active = leads.filter(isActiveLead);
  const phoneMap = new Map<string, string[]>();
  const emailMap = new Map<string, string[]>();

  for (const lead of active) {
    const phoneKey = normalizeMergePhoneKey(lead.phone_number);
    if (phoneKey) {
      const list = phoneMap.get(phoneKey) ?? [];
      list.push(lead.id);
      phoneMap.set(phoneKey, list);
    }
    const emailKey = normalizeMergeEmailKey(lead.email);
    if (emailKey) {
      const list = emailMap.get(emailKey) ?? [];
      list.push(lead.id);
      emailMap.set(emailKey, list);
    }
  }

  const clusters: LeadMergeCluster[] = [];
  for (const [clusterKey, leadIds] of phoneMap) {
    if (leadIds.length >= 2) {
      clusters.push({ kind: "phone", clusterKey, leadIds: [...leadIds] });
    }
  }
  for (const [clusterKey, leadIds] of emailMap) {
    if (leadIds.length >= 2) {
      clusters.push({ kind: "email", clusterKey, leadIds: [...leadIds] });
    }
  }
  return clusters;
}
