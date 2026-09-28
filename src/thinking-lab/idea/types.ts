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

/** LOCKED means other explanations are closed so the Master Thought subject is a plausible cause. */
export type IdeaCauseLock = "LOCKED" | "OPEN" | "UNRESOLVED";

/** SITUATION creates a scene. VERBAL explains the Big Thought in words and is that level's job. */
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

export type IdeaSemanticFacts = {
  code: string;
  whatItSays: string;
  relationToParent: IdeaRelation;
  parentFit: IdeaTriState;
  conceptualForm: IdeaConceptualForm;
  creativeMechanism: IdeaCreativeMechanism;
  conceptualCompleteness: IdeaConceptualCompleteness;
  executionIndependence: IdeaExecutionIndependence;
  boundedness: IdeaBoundedness;
  causeLock: IdeaCauseLock;
  situationForm: IdeaSituationForm;
  resolution: IdeaResolution;
  unresolvedReasons: string[];
  confidence?: number;
};

export type IdeaCandidate = {
  code: string;
  statement: string;
  parentAngleCode: string;
};
