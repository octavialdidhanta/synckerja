export type AngleTriState = true | false | "unresolved";

export type AngleRelation =
  | "VALID_ANGLE"
  | "OUT_OF_PARENT_SCOPE"
  | "TERRITORY_LIKE"
  | "BIG_THOUGHT_LIKE"
  | "IDEA_LIKE"
  | "EXECUTION_LIKE"
  | "INSUFFICIENT_IDEA_GENERATIVITY"
  | "UNBOUNDED_ANGLE"
  | "UNRESOLVED";

export type AngleConceptualForm =
  | "ANGLE_PROPOSITION"
  | "TERRITORY_LIKE"
  | "BIG_THOUGHT_LIKE"
  | "IDEA_LIKE"
  | "EXECUTION_LIKE"
  | "UNRESOLVED";

export type AngleIdeaGenerativity = "SUFFICIENT" | "INSUFFICIENT" | "UNRESOLVED";

export type AngleBoundedness = "BOUNDED" | "UNBOUNDED" | "UNRESOLVED";

export type AngleJobForm = "OBSERVATION" | "REASON" | "TERRITORY_SUMMARY" | "UNRESOLVED";

export type AngleResolution = "RESOLVED" | "UNRESOLVED";

export type AngleSemanticFacts = {
  code: string;
  whatItSays: string;
  relationToParent: AngleRelation;
  parentFit: AngleTriState;
  conceptualForm: AngleConceptualForm;
  ideaGenerativity: AngleIdeaGenerativity;
  boundedness: AngleBoundedness;
  jobForm: AngleJobForm;
  resolution: AngleResolution;
  unresolvedReasons: string[];
  confidence?: number;
};

export type AngleCoverage = "SUFFICIENT" | "MATERIAL_GAP" | "UNRESOLVED";

export type AngleChallengerStatus = "COMPLETE" | "MATERIAL_GAP" | "UNRESOLVED";

export type AnglePair = {
  angleCodeA: string;
  angleCodeB: string;
  explanation: string;
};

export type AngleContainment = {
  containerCode: string;
  containedCode: string;
  explanation: string;
};

export type AngleSetFacts = {
  fingerprint: string;
  coreDistinct: AngleTriState;
  materialOverlapPairs: AnglePair[];
  containmentPairs: AngleContainment[];
  coverage: AngleCoverage;
  resolution: AngleResolution;
  unresolvedReasons: string[];
  confidence?: number;
};

export type AngleChallengerResult = {
  status: AngleChallengerStatus;
  unresolvedReasons: string[];
  materialGapDescription?: string;
  confidence?: number;
};

export type AngleCandidate = {
  code: string;
  statement: string;
  parentTerritoryCode: string;
};
