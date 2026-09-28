import type { Resolution } from "@/thinking-lab/shared/verdict";

export type ConfirmationSource = "original" | "recommendation" | "edited";

export type MasterAdmission = "USABLE" | "UNUSABLE" | "UNRESOLVED" | "STALE";

export type UnderstandOutcome =
  | "ORIGINAL_READY"
  | "PROPOSAL_RECOMMENDED"
  | "CLARIFICATION_REQUIRED"
  | "UNRESOLVED";

export type MasterThoughtFacts = {
  outcome: UnderstandOutcome;
  /** The thing that must later be visible as the cause at Idea. Null when it cannot be named. */
  subject: string | null;
  proposedRootBelief: string | null;
  formulationNote: string | null;
  clarificationQuestion: string | null;
  clarificationOptions: string[] | null;
  resolution: Resolution;
  unresolvedReasons: string[];
  confidence?: number;
};

export type MasterBeliefInput = {
  planted: string;
  priorBelief: string;
  audience: string;
};

export type LabMasterThought = {
  id: string;
  organizationId: string;
  originalInput: string;
  priorBelief: string;
  audience: string;
  statement: string;
  rootBelief: string;
  confirmationSource: ConfirmationSource | null;
  confirmedAt: string | null;
  mtStatus: string;
  status: string;
  canonicalSemantic: MasterThoughtFacts | null;
  semanticFingerprint: string | null;
  lastAudit: unknown;
  updatedAt: string;
};
