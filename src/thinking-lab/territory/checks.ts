import { parseModelJson } from "@/thinking-lab/shared/ai";
import { admitTerritory } from "@/thinking-lab/territory/policy";
import type { TerritorySemanticFacts, TerritoryTriState } from "@/thinking-lab/territory/types";

function readScope(script: string | null, key: string): TerritoryTriState {
  if (!script?.trim()) return "unresolved";
  const parsed = parseModelJson(script);
  const raw =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)[key]
      : script;
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  if (typeof raw !== "string") return "unresolved";
  const token = raw.trim().toLowerCase();
  if (token === "true") return true;
  if (token === "false") return false;
  return "unresolved";
}

export function buildTerritoryPlacePrompt(input: {
  statement: string;
  parentStatement: string;
  audience?: string;
}): string {
  const audience = input.audience?.trim();
  return [
    "Decide one fact about this Territory name.",
    "area is true only when this is a noun or a noun phrase the audience already uses for an area in their world: a phenomenon, a habit, a life moment, a culture, or an everyday problem, where the Big Thought's reason can be discussed, and the name states no claim.",
    "Kurir paket is true. Gaptek is true.",
    "area is false when the name is a keyword of the Big Thought, an internal term, a claim, or a label the audience does not use for an area.",
    "Choose true or false.",
    audience ? `Audience: ${audience}` : "Use the audience named by the Big Thought.",
    "Return JSON only: {\"area\":true} or {\"area\":false}",
    "",
    `Name: ${input.statement.trim()}`,
    "Big Thought, for context only:",
    input.parentStatement.trim(),
  ].join("\n");
}

export function parseTerritoryPlace(script: string | null): TerritoryTriState {
  return readScope(script, "area");
}

export function buildTerritoryLivedFitPrompt(input: { statement: string; question: string }): string {
  return [
    "Decide one fact. Do not write a sentence.",
    `The question is: "${input.question.trim()}"`,
    "lived is true only when that question actually comes up in this named area in real life.",
    "lived is false when a different question comes up there, or when the question only restates the Big Thought.",
    "Other questions coming up in that area do not make lived false.",
    "Choose true or false.",
    "Return JSON only: {\"lived\":true} or {\"lived\":false}",
    "",
    `Place: ${input.statement.trim()}`,
  ].join("\n");
}

export function parseTerritoryLivedFit(script: string | null): TerritoryTriState {
  return readScope(script, "lived");
}

export function buildTerritorySceneJudgePrompt(input: {
  territory: string;
  sentence: string;
  parentStatement: string;
}): string {
  return [
    "A different step wrote this sentence. Judge it. Do not rewrite it.",
    "copiesReason is true when the sentence restates the Big Thought's reason, its lack, or its conclusion.",
    "copiesReason is false when the sentence only says what is happening in the place.",
    "unresolved when that cannot be decided.",
    "Return JSON only: {\"copiesReason\":true} or {\"copiesReason\":false} or {\"copiesReason\":\"unresolved\"}",
    "",
    `Territory: ${input.territory.trim()}`,
    `Sentence: ${input.sentence.trim()}`,
    "Big Thought:",
    input.parentStatement.trim(),
  ].join("\n");
}

export function parseTerritorySceneJudge(script: string | null): "SITUATION" | "COPY" | "UNRESOLVED" {
  const value = readScope(script, "copiesReason");
  if (value === false) return "SITUATION";
  if (value === true) return "COPY";
  return "UNRESOLVED";
}

export function territoryScreenRejection(
  code: string,
  relation: "OUT_OF_PARENT_SCOPE" | "QUESTION_NOT_LIVED",
): TerritorySemanticFacts {
  return {
    code,
    whatItSays: "",
    relationToParent: relation,
    parentFit: relation !== "OUT_OF_PARENT_SCOPE",
    conceptualForm: "TERRITORY_SPACE",
    parentScopeDuplication: false,
    generativity: "SUFFICIENT",
    boundedness: "BOUNDED",
    nominalForm: "NOMINAL",
    audienceLanguage: "AUDIENCE",
    livedQuestion: relation !== "QUESTION_NOT_LIVED",
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

export function applyPlaceCheck(facts: TerritorySemanticFacts, place: TerritoryTriState): TerritorySemanticFacts {
  if (admitTerritory(facts) !== "GENERATE_VALID" || place === true) return facts;
  return {
    ...facts,
    parentFit: false,
    relationToParent: "OUT_OF_PARENT_SCOPE",
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

export function applyLivedCheck(facts: TerritorySemanticFacts, lived: TerritoryTriState): TerritorySemanticFacts {
  if (admitTerritory(facts) !== "GENERATE_VALID" || lived === true) return facts;
  return {
    ...facts,
    livedQuestion: false,
    relationToParent: "QUESTION_NOT_LIVED",
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}
