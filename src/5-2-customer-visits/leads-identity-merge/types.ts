export type LeadMergeClusterKind = "phone" | "email";

export type LeadMergeSkipReason = "ambiguous_attributed";

export type LeadMergeLeadInput = {
  id: string;
  client: string | null;
  phone_number: string | null;
  email: string | null;
  source: string | null;
  ticket_id: string | null;
  updated_at: string | null;
  created_at: string | null;
  /** Soft-archived losers are excluded from clustering. */
  merged_into_lead_id?: string | null;
};

export type LeadMergeCluster = {
  kind: LeadMergeClusterKind;
  clusterKey: string;
  leadIds: string[];
};

export type LeadMergeClusterPlan =
  | {
      kind: LeadMergeClusterKind;
      clusterKey: string;
      leadIds: string[];
      skipped: false;
      skipReason: null;
      winnerLeadId: string;
      loserLeadIds: string[];
    }
  | {
      kind: LeadMergeClusterKind;
      clusterKey: string;
      leadIds: string[];
      skipped: true;
      skipReason: LeadMergeSkipReason;
      winnerLeadId: null;
      loserLeadIds: [];
    };

export type LeadMergeDryRunResult = {
  organization_id: string;
  clusters: Array<{
    kind: LeadMergeClusterKind;
    cluster_key: string;
    lead_ids: string[];
    skipped: boolean;
    skip_reason: string | null;
    winner_lead_id: string | null;
    loser_lead_ids: string[];
  }>;
  mergeable_count: number;
  skipped_count: number;
};

export type LeadMergeExecuteResult = {
  organization_id: string;
  merged_clusters: number;
  skipped_clusters: number;
  remaining: LeadMergeDryRunResult;
};
