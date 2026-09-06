export type {
  LeadMergeCluster,
  LeadMergeClusterKind,
  LeadMergeClusterPlan,
  LeadMergeDryRunResult,
  LeadMergeExecuteResult,
  LeadMergeLeadInput,
  LeadMergeSkipReason,
} from "./types";
export { normalizeMergePhoneKey } from "./normalizeMergePhoneKey";
export { normalizeMergeEmailKey } from "./normalizeMergeEmailKey";
export { buildLeadMergeClusters } from "./buildLeadMergeClusters";
export { planLeadMergeCluster } from "./planLeadMergeCluster";
export { invokeLeadMergeDryRun } from "./invokeLeadMergeDryRun";
export { invokeLeadMergeExecute } from "./invokeLeadMergeExecute";

export {
  isTypoEmailCandidate,
  isValidIdentityEmail,
  isTypoDomainOf,
  splitEmailLocalDomain,
} from "./typo/isTypoEmailCandidate";
export { buildTypoEmailClusters } from "./typo/buildTypoEmailClusters";
export { planTypoEmailCluster } from "./typo/planTypoEmailCluster";
export { invokeTypoEmailMergeDryRun } from "./typo/invokeTypoEmailMergeDryRun";
export { invokeTypoEmailMergeExecute } from "./typo/invokeTypoEmailMergeExecute";

export { buildIdentityLeadKeys, phoneNodeId, emailNodeId } from "./graph/buildIdentityKeyNodes";
export { buildIdentityBridgeEdges } from "./graph/buildIdentityBridgeEdges";
export { unionIdentityComponents } from "./graph/unionIdentityComponents";
export { planIdentityComponentMerge } from "./graph/planIdentityComponentMerge";
export { invokeIdentityGraphMergeDryRun } from "./graph/invokeIdentityGraphMergeDryRun";
export { invokeIdentityGraphMergeExecute } from "./graph/invokeIdentityGraphMergeExecute";

export { planCheckoutIdentityBridge } from "./bridge/planCheckoutIdentityBridge";
export { invokeCheckoutIdentityBridgeDryRun } from "./bridge/invokeCheckoutIdentityBridgeDryRun";
export { invokeCheckoutIdentityBridgeExecute } from "./bridge/invokeCheckoutIdentityBridgeExecute";
export type {
  CheckoutBridgePlan,
  CheckoutBridgeRpcResult,
  CheckoutBridgeSkipReason,
} from "./bridge/types";
