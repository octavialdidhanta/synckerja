import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";

const REJECT_RELATIONS = new Set<TerritorySemanticFacts["relationToParent"]>([
  "OUT_OF_PARENT_SCOPE",
  "BIG_THOUGHT_LIKE",
  "PARENT_SCOPE_DUPLICATION",
  "ANGLE_LIKE",
  "DOWNSTREAM_EXECUTION_LIKE",
  "INSUFFICIENT_GENERATIVITY",
  "UNBOUNDED_SPACE",
  "CLAIM_BEARING",
  "INTERNAL_LANGUAGE",
  "QUESTION_NOT_LIVED",
]);

export function admitTerritory(facts: TerritorySemanticFacts | null): IndividualAdmission {
  if (!facts) return "UNRESOLVED";
  if (facts.resolution !== "RESOLVED" || facts.unresolvedReasons.length > 0) return "UNRESOLVED";
  if (facts.relationToParent === "UNRESOLVED") return "UNRESOLVED";
  if (facts.relationToParent === "VALID_TERRITORY") return "GENERATE_VALID";
  if (REJECT_RELATIONS.has(facts.relationToParent)) return "GENERATE_REJECT";
  return "UNRESOLVED";
}

export function visibleTerritories<T extends { bigThoughtId: string; admission: IndividualAdmission }>(
  rows: T[],
  bigThoughtId: string,
): T[] {
  return rows.filter((row) => row.bigThoughtId === bigThoughtId && row.admission === "GENERATE_VALID");
}
