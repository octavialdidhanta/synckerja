import { parseModelJson } from "@/thinking-lab/shared/ai";
import { deriveTerritoryRelation } from "@/thinking-lab/territory/semantic";
import type {
  TerritoryGenerativity,
  TerritoryResolution,
  TerritorySemanticFacts,
} from "@/thinking-lab/territory/types";

const GENERATIVITY = ["SUFFICIENT", "INSUFFICIENT", "UNRESOLVED"] as const satisfies readonly TerritoryGenerativity[];

export type GenerativityReview = {
  generativity: TerritoryGenerativity;
  unresolvedReasons: string[];
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asText(row)).filter(Boolean);
}

export function readGenerativityReview(raw: unknown): GenerativityReview {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { generativity: "UNRESOLVED", unresolvedReasons: ["JUDGE_UNPARSEABLE"] };
  }
  const row = raw as Record<string, unknown>;
  const tokens = Array.isArray(row.generativity) ? row.generativity : [row.generativity];
  const recognized = tokens.flatMap((token) => {
    if (typeof token !== "string") return [];
    const match = GENERATIVITY.find((item) => item === token.trim());
    return match ? [match] : [];
  });
  const unique = [...new Set(recognized)];
  const hasUnknown = tokens.some((token) => {
    if (token == null || token === "") return false;
    if (typeof token !== "string") return true;
    return !GENERATIVITY.some((item) => item === token.trim());
  });
  if (unique.length > 1 || hasUnknown || unique.length === 0) {
    return {
      generativity: "UNRESOLVED",
      unresolvedReasons: unique.length > 1 ? ["CONTRADICTORY_CANONICAL_FACTS"] : ["JUDGE_UNPARSEABLE"],
    };
  }
  const generativity = unique[0];
  return {
    generativity,
    unresolvedReasons: generativity === "UNRESOLVED" ? asReasons(row.unresolvedReasons) : [],
  };
}

export function parseGenerativityReview(script: string | null): GenerativityReview {
  if (!script?.trim()) return { generativity: "UNRESOLVED", unresolvedReasons: ["JUDGE_UNAVAILABLE"] };
  const parsed = parseModelJson(script);
  if (!parsed) return { generativity: "UNRESOLVED", unresolvedReasons: ["JUDGE_UNPARSEABLE"] };
  return readGenerativityReview(parsed);
}

function unresolvedFactReasons(facts: TerritorySemanticFacts): string[] {
  const reasons: string[] = [];
  if (facts.parentFit === "unresolved") reasons.push("PARENT_FIT_UNRESOLVED");
  if (facts.conceptualForm === "UNRESOLVED") reasons.push("CONCEPTUAL_FORM_UNRESOLVED");
  if (facts.parentScopeDuplication === "unresolved") reasons.push("PARENT_SCOPE_DUPLICATION_UNRESOLVED");
  if (facts.generativity === "UNRESOLVED") reasons.push("GENERATIVITY_UNRESOLVED");
  if (facts.boundedness === "UNRESOLVED") reasons.push("BOUNDEDNESS_UNRESOLVED");
  if (facts.nominalForm === "UNRESOLVED") reasons.push("NOMINAL_FORM_UNRESOLVED");
  if (facts.audienceLanguage === "UNRESOLVED") reasons.push("AUDIENCE_LANGUAGE_UNRESOLVED");
  if (facts.livedQuestion === "unresolved") reasons.push("LIVED_QUESTION_UNRESOLVED");
  return reasons;
}

function resolutionFor(relation: TerritorySemanticFacts["relationToParent"]): TerritoryResolution {
  return relation === "UNRESOLVED" ? "UNRESOLVED" : "RESOLVED";
}

export function sealTerritoryFacts(facts: TerritorySemanticFacts, review: GenerativityReview): TerritorySemanticFacts {
  const generativity = review.generativity;
  const next: TerritorySemanticFacts = { ...facts, generativity };
  const relationToParent = deriveTerritoryRelation(next);
  const resolution = resolutionFor(relationToParent);
  if (resolution === "RESOLVED") {
    return { ...next, relationToParent, resolution, unresolvedReasons: [] };
  }
  const unresolvedReasons = [
    ...new Set([
      ...review.unresolvedReasons,
      ...unresolvedFactReasons({ ...next, generativity }),
    ]),
  ];
  return {
    ...next,
    relationToParent,
    resolution,
    unresolvedReasons: unresolvedReasons.length > 0 ? unresolvedReasons : ["UNRESOLVED"],
  };
}

export function buildGenerativityPrompt(input: { parentStatement: string; statement: string }): string {
  return [
    "You review one Territory candidate under one direct Big Thought.",
    "Decide only whether this conceptual space can hold several substantively distinct Angles without leaving its own boundary.",
    "Distinct means different points of view, claims, questions, or interpretations.",
    "Paraphrases of one claim are not distinct.",
    "Do not count sentences, words, or wording variety.",
    "A short space can be sufficient. A long space can be insufficient.",
    "Do not compare this candidate with sibling Territories.",
    "Do not decide parent fit, conceptual form, scope duplication, boundedness, or the final relation.",
    "Return SUFFICIENT, INSUFFICIENT, or UNRESOLVED.",
    "Use unresolvedReasons only when the decision cannot be made.",
    "Return JSON only:",
    JSON.stringify({ generativity: "UNRESOLVED", unresolvedReasons: [] }),
    "",
    "Direct Big Thought:",
    input.parentStatement.trim(),
    "",
    "Candidate Territory:",
    input.statement.trim(),
  ].join("\n");
}

export async function reviewTerritoryGenerativity(
  input: { parentStatement: string; statement: string },
  ask: (prompt: string) => Promise<string | null>,
): Promise<GenerativityReview> {
  const script = await ask(buildGenerativityPrompt(input));
  return parseGenerativityReview(script);
}
