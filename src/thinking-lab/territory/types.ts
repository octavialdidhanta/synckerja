export type TerritoryTriState = true | false | "unresolved";

export type TerritoryRelation =
  | "VALID_TERRITORY"
  | "OUT_OF_PARENT_SCOPE"
  | "BIG_THOUGHT_LIKE"
  | "PARENT_SCOPE_DUPLICATION"
  | "ANGLE_LIKE"
  | "DOWNSTREAM_EXECUTION_LIKE"
  | "INSUFFICIENT_GENERATIVITY"
  | "UNBOUNDED_SPACE"
  | "CLAIM_BEARING"
  | "INTERNAL_LANGUAGE"
  | "QUESTION_NOT_LIVED"
  | "UNRESOLVED";

export type TerritoryConceptualForm =
  | "TERRITORY_SPACE"
  | "BIG_THOUGHT_LIKE"
  | "ANGLE_LIKE"
  | "DOWNSTREAM_EXECUTION_LIKE"
  | "UNRESOLVED";

export type TerritoryGenerativity = "SUFFICIENT" | "INSUFFICIENT" | "UNRESOLVED";

export type TerritoryBoundedness = "BOUNDED" | "UNBOUNDED" | "UNRESOLVED";

export type TerritoryNominalForm = "NOMINAL" | "CLAIM" | "UNRESOLVED";

export type TerritoryAudienceLanguage = "AUDIENCE" | "INTERNAL" | "UNRESOLVED";

export type TerritoryResolution = "RESOLVED" | "UNRESOLVED";

export type TerritoryCoverage = "SUFFICIENT" | "MATERIAL_GAP" | "UNRESOLVED";

export type TerritoryChallengerStatus = "COMPLETE" | "MATERIAL_GAP" | "UNRESOLVED";

export type TerritorySemanticFacts = {
  code: string;
  whatItSays: string;
  relationToParent: TerritoryRelation;
  parentFit: TerritoryTriState;
  conceptualForm: TerritoryConceptualForm;
  parentScopeDuplication: TerritoryTriState;
  generativity: TerritoryGenerativity;
  boundedness: TerritoryBoundedness;
  nominalForm: TerritoryNominalForm;
  audienceLanguage: TerritoryAudienceLanguage;
  livedQuestion: TerritoryTriState;
  resolution: TerritoryResolution;
  unresolvedReasons: string[];
  confidence?: number;
};

export type TerritoryPair = {
  territoryCodeA: string;
  territoryCodeB: string;
  explanation: string;
};

export type TerritoryContainment = {
  containerCode: string;
  containedCode: string;
  explanation: string;
};

export type TerritorySetFacts = {
  fingerprint: string;
  coreDistinct: TerritoryTriState;
  materialOverlapPairs: TerritoryPair[];
  containmentPairs: TerritoryContainment[];
  coverage: TerritoryCoverage;
  resolution: TerritoryResolution;
  unresolvedReasons: string[];
  confidence?: number;
};

export type TerritoryChallengerResult = {
  status: TerritoryChallengerStatus;
  unresolvedReasons: string[];
  materialGapDescription?: string;
  confidence?: number;
};

export type TerritoryCandidate = {
  code: string;
  statement: string;
  parentBigThoughtCode: string;
};
