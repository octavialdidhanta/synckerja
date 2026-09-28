import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import type { ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

const REJECT_RELATIONS = new Set<ExecutionSemanticFacts["relationToParent"]>([
  "MESSAGE_ADDED",
  "MECHANISM_HIDDEN",
  "PILLAR_OUTSIDE",
  "PILLAR_NOT_SELLING",
  "CLIMB_MISSED",
  "SUBJECT_MISMATCH",
]);

export function admitExecution(facts: ExecutionSemanticFacts | null): IndividualAdmission {
  if (!facts) return "UNRESOLVED";
  if (facts.resolution !== "RESOLVED" || facts.unresolvedReasons.length > 0) return "UNRESOLVED";
  if (facts.relationToParent === "VALID_EXECUTION") return "GENERATE_VALID";
  if (REJECT_RELATIONS.has(facts.relationToParent)) return "GENERATE_REJECT";
  return "UNRESOLVED";
}
