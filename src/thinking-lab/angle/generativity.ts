import { parseModelJson } from "@/thinking-lab/shared/ai";
import { deriveAngleRelation } from "@/thinking-lab/angle/semantic";
import type { AngleIdeaGenerativity, AngleResolution, AngleSemanticFacts } from "@/thinking-lab/angle/types";

const IDEA_GENERATIVITY = ["SUFFICIENT", "INSUFFICIENT", "UNRESOLVED"] as const satisfies readonly AngleIdeaGenerativity[];

export type IdeaGenerativityReview = {
  ideaGenerativity: AngleIdeaGenerativity;
  unresolvedReasons: string[];
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asText(row)).filter(Boolean);
}

export function readIdeaGenerativityReview(raw: unknown): IdeaGenerativityReview {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ideaGenerativity: "UNRESOLVED", unresolvedReasons: ["JUDGE_UNPARSEABLE"] };
  }
  const row = raw as Record<string, unknown>;
  const tokens = Array.isArray(row.ideaGenerativity) ? row.ideaGenerativity : [row.ideaGenerativity];
  const recognized = tokens.flatMap((token) => {
    if (typeof token !== "string") return [];
    const match = IDEA_GENERATIVITY.find((item) => item === token.trim());
    return match ? [match] : [];
  });
  const unique = [...new Set(recognized)];
  const hasUnknown = tokens.some((token) => {
    if (token == null || token === "") return false;
    if (typeof token !== "string") return true;
    return !IDEA_GENERATIVITY.some((item) => item === token.trim());
  });
  if (unique.length > 1 || hasUnknown || unique.length === 0) {
    return {
      ideaGenerativity: "UNRESOLVED",
      unresolvedReasons: unique.length > 1 ? ["CONTRADICTORY_CANONICAL_FACTS"] : ["JUDGE_UNPARSEABLE"],
    };
  }
  const ideaGenerativity = unique[0];
  return {
    ideaGenerativity,
    unresolvedReasons: ideaGenerativity === "UNRESOLVED" ? asReasons(row.unresolvedReasons) : [],
  };
}

export function parseIdeaGenerativityReview(script: string | null): IdeaGenerativityReview {
  if (!script?.trim()) return { ideaGenerativity: "UNRESOLVED", unresolvedReasons: ["JUDGE_UNAVAILABLE"] };
  const parsed = parseModelJson(script);
  if (!parsed) return { ideaGenerativity: "UNRESOLVED", unresolvedReasons: ["JUDGE_UNPARSEABLE"] };
  return readIdeaGenerativityReview(parsed);
}

function unresolvedFactReasons(facts: AngleSemanticFacts): string[] {
  const reasons: string[] = [];
  if (facts.parentFit === "unresolved") reasons.push("PARENT_FIT_UNRESOLVED");
  if (facts.conceptualForm === "UNRESOLVED") reasons.push("CONCEPTUAL_FORM_UNRESOLVED");
  if (facts.ideaGenerativity === "UNRESOLVED") reasons.push("IDEA_GENERATIVITY_UNRESOLVED");
  if (facts.boundedness === "UNRESOLVED") reasons.push("BOUNDEDNESS_UNRESOLVED");
  if (facts.jobForm === "UNRESOLVED") reasons.push("JOB_FORM_UNRESOLVED");
  return reasons;
}

function resolutionFor(relation: AngleSemanticFacts["relationToParent"]): AngleResolution {
  return relation === "UNRESOLVED" ? "UNRESOLVED" : "RESOLVED";
}

export function sealAngleFacts(facts: AngleSemanticFacts, review: IdeaGenerativityReview): AngleSemanticFacts {
  const ideaGenerativity = review.ideaGenerativity;
  const next: AngleSemanticFacts = { ...facts, ideaGenerativity };
  const relationToParent = deriveAngleRelation(next);
  const resolution = resolutionFor(relationToParent);
  if (resolution === "RESOLVED") {
    return { ...next, relationToParent, resolution, unresolvedReasons: [] };
  }
  const unresolvedReasons = [
    ...new Set([...review.unresolvedReasons, ...unresolvedFactReasons({ ...next, ideaGenerativity })]),
  ];
  return {
    ...next,
    relationToParent,
    resolution,
    unresolvedReasons: unresolvedReasons.length > 0 ? unresolvedReasons : ["UNRESOLVED"],
  };
}

export function buildAngleGenerativityPrompt(input: { parentStatement: string; statement: string }): string {
  return [
    "You review idea generativity for one Angle under one direct Territory.",
    "You are the only owner of idea-generativity status.",
    "Decide whether this Angle can plausibly generate several semantically distinct Ideas.",
    "Distinct means different creative concepts. They may differ by mechanism, narrative concept, experiment, comparison, metaphor, proof structure, scenario, or character dynamic.",
    "Wording variants, title variants, format swaps alone, and cosmetic changes are not distinct Ideas.",
    "Do not count sentences, words, or wording variety.",
    "A short proposition can be sufficient. A long proposition can be insufficient.",
    "Do not compare this candidate with sibling Angles.",
    "Do not decide parent fit, conceptual form, boundedness, or the final relation.",
    "Return SUFFICIENT, INSUFFICIENT, or UNRESOLVED.",
    "Use unresolvedReasons only when the decision cannot be made.",
    "Return JSON only:",
    JSON.stringify({ ideaGenerativity: "UNRESOLVED", unresolvedReasons: [] }),
    "",
    "Direct Territory:",
    input.parentStatement.trim(),
    "",
    "Candidate Angle:",
    input.statement.trim(),
  ].join("\n");
}

export async function reviewAngleGenerativity(
  input: { parentStatement: string; statement: string },
  ask: (prompt: string) => Promise<string | null>,
): Promise<IdeaGenerativityReview> {
  const script = await ask(buildAngleGenerativityPrompt(input));
  return parseIdeaGenerativityReview(script);
}
