export const CREATIVE_FORMATS = ["video", "carousel", "post"] as const;
export type CreativeFormat = (typeof CREATIVE_FORMATS)[number];

export const CREATIVE_CRITERIA = ["CK1", "CK2", "CK3", "CK4", "CK5"] as const;
export type CreativeCriterionId = (typeof CREATIVE_CRITERIA)[number];
export type CreativeCriterionStatus = "PASS" | "FAIL" | "BELUM_TERVERIFIKASI";
export type CreativeDecision = "READY" | "NEEDS_REFINEMENT" | "REVISE" | "REJECTED" | "NOT_VERIFIED";

export const PILLAR_FIT_STATUSES = ["RECOMMENDED", "POSSIBLE_WITH_ADAPTATION", "NOT_SUITABLE", "NOT_REVIEWED"] as const;
export type PillarFitStatus = (typeof PILLAR_FIT_STATUSES)[number];

export const CREATIVE_VALIDATION_SCHEMA = "thinking-lab/creative-idea-validation/v1";
export const CREATIVE_GENERATOR_VERSION = "creative-idea/v1";
export const CREATIVE_VALIDATOR_VERSION = "creative-audit/v1";
export const CREATIVE_BATCH = 3;
export const PILLAR_REVIEW_LIMIT = 12;

export type CreativeCriterion = {
  id: CreativeCriterionId;
  status: CreativeCriterionStatus;
  reason: string;
};

export type CreativeValidation = {
  schema: typeof CREATIVE_VALIDATION_SCHEMA;
  criteria: CreativeCriterion[];
  decision: CreativeDecision;
  recommendation: string;
  title: string;
  concept: string;
  mechanism: string;
  value: string;
  generatorVersion: typeof CREATIVE_GENERATOR_VERSION;
  validatorVersion: typeof CREATIVE_VALIDATOR_VERSION;
  validatedAt: string;
  statement: string;
};

export type StoredPillarReview = {
  contentPillarId: string;
  pillarName: string;
  status: "RECOMMENDED";
  reason: string;
  /** What the conceptual idea becomes when this pillar carries it. */
  development: string;
};

export type DevelopmentPath = {
  contentPillarId: string;
  pillarName: string;
  /** Null means the pillar is locked and no format has been chosen yet. */
  format: CreativeFormat | null;
  status: PillarFitStatus;
  reason: string;
  reviews: StoredPillarReview[];
  savedAt: string;
};

export type CreativeDraft = {
  title: string;
  statement: string;
  concept: string;
  mechanism: string;
  value: string;
};

export type CreativeExecutionLink = {
  creativeIdeaId: string;
  format: CreativeFormat;
  statement: string;
  concept: string;
  mechanism: string;
  value: string;
};

export type LabCreativeIdea = {
  id: string;
  organizationId: string;
  ideaId: string;
  contentPillarId: string;
  format: CreativeFormat;
  code: string;
  title: string;
  statement: string;
  concept: string;
  mechanism: string;
  value: string;
  validation: CreativeValidation | null;
  status: "candidate" | "selected";
};
