import type { LeadMergeLeadInput, LeadMergeSkipReason } from "../types";

export type CheckoutBridgeSkipReason =
  | LeadMergeSkipReason
  | "same_lead"
  | "lead_not_found_or_archived"
  | "missing_phone_or_email_key"
  | "invalid_email";

export type CheckoutBridgePlan =
  | {
      skipped: false;
      skipReason: null;
      winnerLeadId: string;
      loserLeadIds: string[];
      clusterKey: string;
      phoneLeadId: string;
      emailLeadId: string;
    }
  | {
      skipped: true;
      skipReason: CheckoutBridgeSkipReason;
      winnerLeadId: string | null;
      loserLeadIds: [];
      clusterKey: string | null;
      phoneLeadId: string;
      emailLeadId: string;
    };

export type CheckoutBridgeRpcResult = {
  organization_id: string;
  skipped: boolean;
  skip_reason: string | null;
  winner_lead_id: string | null;
  loser_lead_ids: string[];
  cluster_key: string | null;
  phone_lead_id?: string;
  email_lead_id?: string;
  merged: boolean;
};
