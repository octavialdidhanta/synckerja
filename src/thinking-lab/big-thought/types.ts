import type { Resolution, TriState } from "../shared/verdict";

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

export type PassGateId = "resolved" | "relation" | "explains" | "premise" | "showable" | "duplicate";

export type GateFailure = {
  gate: PassGateId;
  reason: string;
  earlier: "pass" | "unchecked";
};

export type BigThoughtFacts = {
  code: string;
  whatItSays: string;
  relationToParent: ParentRelation;
  explainsWhyParentIsTrue: TriState;
  introducesUnsupportedPremise: TriState;
  duplicateOfCode: string | null;
  resolution: Resolution;
  unresolvedReasons: string[];
  answeredQuestion?: string;
  answeredQuestionVersion?: number;
  gateFailure?: GateFailure;
  /** Set only after every pass gate was confirmed, one at a time. */
  passConfirmed?: true;
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

export type GenerateMode = "fill";
