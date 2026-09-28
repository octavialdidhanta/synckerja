export const EXECUTION_PILLARS = [
  { id: "B_ROLL_STORYTELLING", label: "B-Roll Storytelling" },
  { id: "BEHIND_THE_SCENE", label: "Behind The Scene" },
  { id: "BACA_KOMEN_HATERS", label: "Baca Komen Haters" },
  { id: "FLASH_SALE_HOOK", label: "Flash Sale Hook" },
] as const;

export type ExecutionPillar = (typeof EXECUTION_PILLARS)[number]["id"];

export type ExecutionTriState = true | false | "unresolved";

export type ExecutionViewerClimb = "CLIMBS" | "OTHER" | "NEGATIVE" | "UNRESOLVED";
export type ExecutionSubjectMatch = "MATCH" | "OTHER" | "UNRESOLVED";

export type ExecutionRelation =
  | "VALID_EXECUTION"
  | "MESSAGE_ADDED"
  | "MECHANISM_HIDDEN"
  | "PILLAR_OUTSIDE"
  | "PILLAR_NOT_SELLING"
  | "CLIMB_MISSED"
  | "SUBJECT_MISMATCH"
  | "UNRESOLVED";

export type ExecutionSemanticFacts = {
  pillar: ExecutionPillar | "UNRESOLVED";
  whatItSays: string;
  relationToParent: ExecutionRelation;
  messageAdded: ExecutionTriState;
  mechanismVisible: ExecutionTriState;
  pillarOutside: ExecutionTriState;
  masterSells: ExecutionTriState;
  viewerClimb: ExecutionViewerClimb;
  subjectMatch: ExecutionSubjectMatch;
  resolution: "RESOLVED" | "UNRESOLVED";
  unresolvedReasons: string[];
};

export function isExecutionPillar(value: string): value is ExecutionPillar {
  return EXECUTION_PILLARS.some((pillar) => pillar.id === value);
}

export function executionPillarLabel(id: ExecutionPillar): string {
  return EXECUTION_PILLARS.find((pillar) => pillar.id === id)?.label ?? id;
}
