import type { Resolution, TriState } from "@/thinking-lab/shared/verdict";

export type ParentRelation =
  | "DISTINCT_MATERIAL_SUPPORT"
  | "RESTATEMENT"
  | "ELABORATION"
  | "OUTCOME"
  | "CONSEQUENCE"
  | "METHOD"
  | "CRITERION"
  | "EXAMPLE"
  | "TACTIC"
  | "EXECUTION"
  | "DUPLICATE"
  | "UNSUPPORTED_PREMISE"
  | "UNRESOLVED";

export type SupportRole = "PREMISE" | "REASON" | "EVIDENCE" | "UNRESOLVED";

export type BigThoughtFacts = {
  code: string;
  whatItSays: string;
  relationToParent: ParentRelation;
  supportRole: SupportRole;
  explainsWhyParentIsTrue: TriState;
  introducesUnsupportedPremise: TriState;
  duplicateOfCode: string | null;
  resolution: Resolution;
  unresolvedReasons: string[];
  confidence?: number;
  judgmentVerdict?: string;
  judgmentReason?: string;
};

export type ReasonContributionFact = {
  code: string;
  reasonContribution: string;
};

export type SameReasonPair = {
  a: string;
  b: string;
  explanation: string;
};

export type SiblingSetFacts = {
  fingerprint: string;
  distinct: TriState;
  duplicatePairs: SameReasonPair[];
  reasonContributions: ReasonContributionFact[];
  resolution: Resolution;
  unresolvedReasons: string[];
  confidence?: number;
};

export type AuditItem = {
  code: string;
  verdict: "AUDIT_PASS" | "AUDIT_FAIL" | "UNRESOLVED" | "STALE";
  statementFingerprint?: string;
};

export type ChallengerStatus = "COMPLETE" | "MISSING_MATERIAL_SUPPORT" | "UNRESOLVED";

export type MissingWhy = {
  description: string;
  boundary: string;
};

export type ChallengerFacts = {
  setFingerprint: string;
  status: ChallengerStatus;
  missingWhyDescription: string;
  missingWhyBoundary: string;
  resolution: Resolution;
  unresolvedReasons: string[];
  confidence?: number;
};

export type SemanticExclusion = {
  reasonContribution: string;
  explanation: string;
  codes: string[];
};

export type SemanticExclusionHistory = {
  parentFingerprint: string;
  entries: SemanticExclusion[];
};

export type LabSetRecord = {
  schema: "thinking-lab/v1";
  siblingSet: SiblingSetFacts | null;
  audit: {
    setFingerprint: string;
    items: AuditItem[];
  } | null;
  challenger: ChallengerFacts | null;
  semanticExclusions: SemanticExclusionHistory | null;
};

export type LabBigThought = {
  id: string;
  organizationId: string;
  masterThoughtId: string;
  code: string;
  statement: string;
  label: string;
  status: "candidate" | "locked" | "rejected";
  sortOrder: number;
  canonicalSemantic: BigThoughtFacts | null;
  semanticFingerprint: string | null;
};

export type GenerateMode = "fill" | "gap";
