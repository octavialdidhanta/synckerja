import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import type { IdeaSemanticFacts } from "@/thinking-lab/idea/types";

const REJECT_RELATIONS = new Set<IdeaSemanticFacts["relationToParent"]>([
  "OUT_OF_PARENT_SCOPE",
  "ANGLE_LIKE",
  "TERRITORY_LIKE",
  "BIG_THOUGHT_LIKE",
  "EXECUTION_LIKE",
  "UNDERDEVELOPED_CONCEPT",
  "UNBOUNDED_IDEA",
  "CAUSE_UNLOCKED",
]);

export function admitIdea(facts: IdeaSemanticFacts | null): IndividualAdmission {
  if (!facts) return "UNRESOLVED";
  if (facts.resolution !== "RESOLVED" || facts.unresolvedReasons.length > 0) return "UNRESOLVED";
  if (facts.relationToParent === "UNRESOLVED") return "UNRESOLVED";
  if (facts.relationToParent === "VALID_IDEA") return "GENERATE_VALID";
  if (REJECT_RELATIONS.has(facts.relationToParent)) return "GENERATE_REJECT";
  return "UNRESOLVED";
}

export function visibleIdeas<T extends { angleId: string; admission: IndividualAdmission }>(
  rows: T[],
  angleId: string,
): T[] {
  return rows.filter((row) => row.angleId === angleId && row.admission === "GENERATE_VALID");
}
