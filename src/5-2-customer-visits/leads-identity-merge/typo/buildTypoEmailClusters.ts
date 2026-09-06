import type { LeadMergeLeadInput } from "../types";
import {
  isTypoDomainOf,
  isTypoEmailCandidate,
  isValidIdentityEmail,
  splitEmailLocalDomain,
} from "./isTypoEmailCandidate";

export type TypoEmailCluster = {
  kind: "typo_email";
  /** Invalid email string (cluster key). */
  clusterKey: string;
  typoLeadId: string;
  /** Valid target lead ids (expect 0 or 1 for mergeable). */
  validLeadIds: string[];
};

/**
 * Build typo → valid email clusters for active leads.
 */
export function buildTypoEmailClusters(leads: LeadMergeLeadInput[]): TypoEmailCluster[] {
  const active = leads.filter((l) => !l.merged_into_lead_id);
  const valid: LeadMergeLeadInput[] = [];
  const typos: LeadMergeLeadInput[] = [];

  for (const lead of active) {
    const email = String(lead.email ?? "").trim();
    if (!email) continue;
    if (isValidIdentityEmail(email)) valid.push(lead);
    else if (isTypoEmailCandidate(email)) typos.push(lead);
  }

  const clusters: TypoEmailCluster[] = [];
  for (const typo of typos) {
    const typoEmail = String(typo.email ?? "").trim().toLowerCase();
    const parts = splitEmailLocalDomain(typoEmail);
    if (!parts) continue;

    const matches = valid.filter((v) => {
      const ve = String(v.email ?? "").trim().toLowerCase();
      const vp = splitEmailLocalDomain(ve);
      if (!vp) return false;
      if (vp.local !== parts.local) return false;
      return isTypoDomainOf(vp.domain, parts.domain);
    });

    clusters.push({
      kind: "typo_email",
      clusterKey: typoEmail,
      typoLeadId: typo.id,
      validLeadIds: matches.map((m) => m.id),
    });
  }
  return clusters;
}
