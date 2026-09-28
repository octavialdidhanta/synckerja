import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import type { AngleSemanticFacts } from "@/thinking-lab/angle/types";

const REJECT_RELATIONS = new Set<AngleSemanticFacts["relationToParent"]>([
  "OUT_OF_PARENT_SCOPE",
  "TERRITORY_LIKE",
  "BIG_THOUGHT_LIKE",
  "IDEA_LIKE",
  "EXECUTION_LIKE",
  "INSUFFICIENT_IDEA_GENERATIVITY",
  "UNBOUNDED_ANGLE",
]);

export function admitAngle(facts: AngleSemanticFacts | null): IndividualAdmission {
  if (!facts) return "UNRESOLVED";
  if (facts.resolution !== "RESOLVED" || facts.unresolvedReasons.length > 0) return "UNRESOLVED";
  if (facts.relationToParent === "UNRESOLVED") return "UNRESOLVED";
  if (facts.relationToParent === "VALID_ANGLE") return "GENERATE_VALID";
  if (REJECT_RELATIONS.has(facts.relationToParent)) return "GENERATE_REJECT";
  return "UNRESOLVED";
}

export function visibleAngles<T extends { territoryId: string; admission: IndividualAdmission }>(
  rows: T[],
  territoryId: string,
): T[] {
  return rows.filter((row) => row.territoryId === territoryId && row.admission === "GENERATE_VALID");
}
