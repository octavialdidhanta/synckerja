export type IdeaTriState = true | false | "unresolved";

export type IdeaRelation =
  | "VALID_IDEA"
  | "OUT_OF_PARENT_SCOPE"
  | "ANGLE_LIKE"
  | "TERRITORY_LIKE"
  | "BIG_THOUGHT_LIKE"
  | "EXECUTION_LIKE"
  | "UNDERDEVELOPED_CONCEPT"
  | "UNBOUNDED_IDEA"
  | "CAUSE_UNLOCKED"
  | "UNRESOLVED";

/** LOCKED means the separate mechanism keys close other explanations so the Master Thought subject is the plausible cause. */
export type IdeaCauseLock = "LOCKED" | "OPEN" | "UNRESOLVED";

/** One other explanation a viewer might reach, and how this Idea closes it. Stored apart from the mechanism sentence. */
export type IdeaMechanismKey = {
  otherExplanation: string;
  close: string;
};

/** SITUATION states the mechanism and lets the reason happen there. VERBAL explains the Big Thought in words. */
export type IdeaSituationForm = "SITUATION" | "VERBAL" | "UNRESOLVED";

export type IdeaConceptualForm =
  | "IDEA_CONCEPT"
  | "ANGLE_LIKE"
  | "TERRITORY_LIKE"
  | "BIG_THOUGHT_LIKE"
  | "EXECUTION_LIKE"
  | "UNRESOLVED";

export type IdeaConceptualCompleteness = "SUFFICIENT" | "INSUFFICIENT" | "UNRESOLVED";

export type IdeaExecutionIndependence = "INDEPENDENT" | "EXECUTION_BOUND" | "UNRESOLVED";

export type IdeaBoundedness = "BOUNDED" | "UNBOUNDED" | "UNRESOLVED";

export type IdeaCreativeMechanism =
  | "COMPARISON"
  | "EXPERIMENT"
  | "NARRATIVE"
  | "METAPHOR"
  | "DEMONSTRATION"
  | "CHALLENGE"
  | "TRANSFORMATION"
  | "SIMULATION"
  | "OBSERVATION"
  | "REVEAL"
  | "CONTRAST"
  | "ROLE_REVERSAL"
  | "OTHER"
  | "UNRESOLVED";

export type IdeaResolution = "RESOLVED" | "UNRESOLVED";

export type IdeaGeneratePass = "sentenceForm" | "mechanismShape";

export type IdeaSemanticFacts = {
  code: string;
  whatItSays: string;
  /** Short name of the mechanism, at most six words. */
  subject: string;
  relationToParent: IdeaRelation;
  parentFit: IdeaTriState;
  conceptualForm: IdeaConceptualForm;
  creativeMechanism: IdeaCreativeMechanism;
  conceptualCompleteness: IdeaConceptualCompleteness;
  executionIndependence: IdeaExecutionIndependence;
  boundedness: IdeaBoundedness;
  causeLock: IdeaCauseLock;
  mechanismKeys: IdeaMechanismKey[];
  situationForm: IdeaSituationForm;
  resolution: IdeaResolution;
  unresolvedReasons: string[];
  /** Present only when this exact sentence passed both Generate checks. */
  generatePasses?: IdeaGeneratePass[];
  confidence?: number;
};

export type IdeaCandidate = {
  code: string;
  statement: string;
  parentAngleCode: string;
};
