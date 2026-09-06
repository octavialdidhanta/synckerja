import type { LeadMergeLeadInput } from "../types";
import type { TypoEmailCluster } from "./buildTypoEmailClusters";

export type TypoEmailClusterPlan =
  | {
      kind: "typo_email";
      clusterKey: string;
      skipped: false;
      skipReason: null;
      winnerLeadId: string;
      loserLeadIds: string[];
    }
  | {
      kind: "typo_email";
      clusterKey: string;
      skipped: true;
      skipReason: "no_typo_target" | "ambiguous_typo_target";
      winnerLeadId: null;
      loserLeadIds: [];
    };

export function planTypoEmailCluster(
  cluster: TypoEmailCluster,
  _leadsById?: Map<string, LeadMergeLeadInput>,
): TypoEmailClusterPlan {
  if (cluster.validLeadIds.length === 0) {
    return {
      kind: "typo_email",
      clusterKey: cluster.clusterKey,
      skipped: true,
      skipReason: "no_typo_target",
      winnerLeadId: null,
      loserLeadIds: [],
    };
  }
  if (cluster.validLeadIds.length > 1) {
    return {
      kind: "typo_email",
      clusterKey: cluster.clusterKey,
      skipped: true,
      skipReason: "ambiguous_typo_target",
      winnerLeadId: null,
      loserLeadIds: [],
    };
  }
  const winner = cluster.validLeadIds[0]!;
  return {
    kind: "typo_email",
    clusterKey: cluster.clusterKey,
    skipped: false,
    skipReason: null,
    winnerLeadId: winner,
    loserLeadIds: [cluster.typoLeadId],
  };
}
