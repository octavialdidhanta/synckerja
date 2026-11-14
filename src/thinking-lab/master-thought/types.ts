import type { MasterCatalogLink } from "./catalog";
import type { ProductReasonPool } from "./productReasonPool";

/** How the saved belief was written. "edited" is only read from older rows. */
export type ConfirmationSource = "original" | "recommendation" | "edited";

export type BeliefOption = {
  belief: string;
  description: string;
};

export type MasterThoughtFacts = {
  /** The thing that must later be visible as the cause at Idea: the saved belief itself. */
  subject: string | null;
  /** Beliefs from "Bantu rumuskan" that passed the switched-on checks, waiting to be picked. */
  beliefOptions: BeliefOption[];
};

/** Catalog linked to a Master Thought, by name: the category is required, sub-categories and features are optional. */
export type MasterCatalogContext = {
  category: string;
  subCategories: string[];
  features: string[];
};

export type MasterBeliefInput = {
  planted: string;
  priorBelief: string;
  audience: string;
  productReasonPool?: ProductReasonPool | null;
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
  productReasonPool: ProductReasonPool | null;
  catalog: MasterCatalogLink;
  updatedAt: string;
};
