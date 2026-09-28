import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import type { BigThoughtFacts } from "@/thinking-lab/big-thought/types";

const REJECT_RELATIONS = new Set<BigThoughtFacts["relationToParent"]>([
  "RESTATEMENT",
  "ELABORATION",
  "OUTCOME",
  "CONSEQUENCE",
  "METHOD",
  "CRITERION",
  "EXAMPLE",
  "TACTIC",
  "EXECUTION",
  "DUPLICATE",
  "UNSUPPORTED_PREMISE",
]);

export function individualAdmission(input: {
  facts: BigThoughtFacts | null;
  factsCurrent: boolean;
}): IndividualAdmission {
  if (!input.factsCurrent) return input.facts ? "STALE" : "UNRESOLVED";
  const facts = input.facts;
  if (!facts) return "UNRESOLVED";
  if (facts.resolution !== "RESOLVED" || facts.unresolvedReasons.length > 0) return "UNRESOLVED";
  if (REJECT_RELATIONS.has(facts.relationToParent)) return "GENERATE_REJECT";
  if (
    facts.relationToParent === "UNRESOLVED" ||
    facts.explainsWhyParentIsTrue === "unresolved" ||
    facts.introducesUnsupportedPremise === "unresolved"
  ) {
    return "UNRESOLVED";
  }
  if (!facts.whatItSays.trim()) return "UNRESOLVED";
  if (facts.duplicateOfCode && facts.relationToParent === "DISTINCT_MATERIAL_SUPPORT") {
    return "UNRESOLVED";
  }
  const supportReady =
    facts.supportRole === "PREMISE" || facts.supportRole === "REASON" || facts.supportRole === "EVIDENCE";
  const valid =
    facts.relationToParent === "DISTINCT_MATERIAL_SUPPORT" &&
    supportReady &&
    facts.explainsWhyParentIsTrue === true &&
    facts.introducesUnsupportedPremise === false &&
    !facts.duplicateOfCode;
  if (valid) return "GENERATE_VALID";
  if (facts.explainsWhyParentIsTrue === false) return "GENERATE_REJECT";
  return "UNRESOLVED";
}
