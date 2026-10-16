export const LEGACY_EXECUTION_PILLARS = [
  { id: "B_ROLL_STORYTELLING", label: "B-Roll Storytelling" },
  { id: "BEHIND_THE_SCENE", label: "Behind The Scene" },
  { id: "BACA_KOMEN_HATERS", label: "Baca Komen Haters" },
  { id: "FLASH_SALE_HOOK", label: "Flash Sale Hook" },
] as const;

/** @deprecated The pillar menu is the organization's content pillars. Kept so older rows still have a label. */
export const EXECUTION_PILLARS = LEGACY_EXECUTION_PILLARS;

export type ExecutionPillar = string;

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
  pillar: string;
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

export function executionPillarLabel(id: string, name?: string | null): string {
  const named = name?.trim();
  if (named) return named;
  return LEGACY_EXECUTION_PILLARS.find((pillar) => pillar.id === id)?.label ?? id;
}

export function isFlashSalePillar(pillar: string): boolean {
  const normalized = pillar.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return normalized.includes("flash sale");
}
