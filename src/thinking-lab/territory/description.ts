import { repeatsMasterConclusion } from "@/thinking-lab/big-thought/answeredQuestion";
import { becauseConnector } from "@/thinking-lab/big-thought/because";
import { parseModelJson } from "@/thinking-lab/shared/ai";

export type TerritoryDescriptions = {
  areaLead: string;
  area: string;
  passLead: string;
  pass: string;
};

function plain(value: string): string {
  return value.trim().replace(/[.。]+$/g, "").replace(/\s+/g, " ").trim();
}

function sameText(left: string, right: string): boolean {
  const a = plain(left).toLowerCase();
  const b = plain(right).toLowerCase();
  return Boolean(a) && a === b;
}

function asSentence(value: string): string {
  const text = plain(value);
  if (!text) return "";
  const first = text.charAt(0);
  const headed = first === first.toUpperCase() ? text : first.toUpperCase() + text.slice(1);
  return `${headed}.`;
}

const empty: TerritoryDescriptions = { areaLead: "", area: "", passLead: "", pass: "" };

/** A gloss explains this Territory only when it is not the name and not the shared Big Thought. */
export function territorySceneIsSpecific(territory: string, lived: string, parentReason = ""): boolean {
  const scene = plain(lived);
  if (!scene) return false;
  if (sameText(scene, territory) || sameText(scene, parentReason)) return false;
  const parent = plain(parentReason).toLowerCase();
  if (parent.length > 24 && scene.toLowerCase().includes(parent)) return false;
  const name = plain(territory);
  const framed = new RegExp(`^(?:di|in)\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (framed.test(scene)) return false;
  if (/^(?:ini yang orang hadapi|this is what people run into)\b/i.test(scene)) return false;
  return true;
}

/** The description under a Territory name. The name stays a noun; this sentence says what happens in that area. */
export function territoryAreaSentence(lived: string, sample: string): string {
  const text = plain(lived).replace(/^(?:di wilayah ini|in this area)\s*,?\s*/i, "").trim();
  if (!text) return "";
  const opening = becauseConnector(sample) === "karena" ? "Di wilayah ini," : "In this area,";
  const body = text.charAt(0).toLowerCase() + text.slice(1);
  return asSentence(`${opening} ${body}`);
}

export function territoryDescriptions(territory: string, lived = "", parentReason = ""): TerritoryDescriptions {
  const name = plain(territory);
  const scene = plain(lived);
  if (!name || !territorySceneIsSpecific(name, scene, parentReason)) return empty;
  const area = territoryAreaSentence(scene, `${name} ${scene} ${parentReason}`);
  if (!area || !territorySceneIsSpecific(name, area, parentReason)) return empty;
  return {
    areaLead: "",
    area,
    passLead: "",
    pass: "",
  };
}

export function buildTerritoryLivedPrompt(input: {
  territory: string;
  parentStatement: string;
  masterStatement?: string;
  audience?: string;
  answeredQuestion?: string;
  siblings?: string[];
}): string {
  const indonesian = becauseConnector(`${input.territory} ${input.parentStatement}`) === "karena";
  const language = indonesian ? "Indonesian" : "English";
  const opening = indonesian ? "Di wilayah ini," : "In this area,";
  const people = input.audience?.trim();
  const question = input.answeredQuestion?.trim() ?? "";
  const master = input.masterStatement?.trim() ?? "";
  const siblings = (input.siblings ?? []).map((row) => row.trim()).filter(Boolean);
  return [
    "Write one sentence that explains this Territory as a situation people are already in.",
    `Write it in ${language}.`,
    `Start the sentence with "${opening}"`,
    people ? `Use words this audience would use: ${people}.` : "Use words the audience would use for this area.",
    "After that opening, say what is happening in this area so the Big Thought's reason can be discussed there.",
    "A different Territory must not be able to reuse the same sentence.",
    ...(question
      ? [
          `People here are about to ask a question in the same family as: ${question}`,
          "Write this Territory's own wording. Do not put the question inside the lived sentence.",
        ]
      : []),
    "Do not repeat the Territory name and do not define what the name means.",
    "Do not quote, translate, or paraphrase the Big Thought.",
    "Do not answer with only the Territory name.",
    "Do not use the frame 'ini yang orang hadapi' or 'this is what people run into'.",
    "Do not write a because-clause, a slogan, or a belief.",
    "Also write the one question people ask in this Territory.",
    "The answer to that question is the Big Thought. Do not write that answer in the question.",
    "A yes-or-no question the Master Thought already settles is the wrong question. Ask the question that still needs this Big Thought's reason.",
    "Do not start the question with apakah, does, is, are, do, or can.",
    ...(siblings.length > 0
      ? ["Other Territories. Do not ask the question that belongs in them:", ...siblings]
      : ["Another Territory must not be able to reuse this question."]),
    "One short question. End it with a question mark. Do not start it with karena or because.",
    'Return JSON only: {"lived":"...","question":"...?"}',
    "",
    `Territory: ${input.territory.trim()}`,
    ...(master ? ["Master Thought, already known, do not ask what it already answers:", master] : []),
    "Big Thought, for fit only, do not copy:",
    input.parentStatement.trim(),
  ].join("\n");
}

export function parseTerritoryLived(
  script: string | null,
  input: { territory: string; parentStatement: string },
): string {
  if (!script?.trim()) return "";
  const parsed = parseModelJson(script);
  const raw =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { lived?: unknown }).lived
      : script;
  const lived = typeof raw === "string" ? plain(raw.split(/(?<=[.。])\s+/)[0] ?? "") : "";
  if (!territorySceneIsSpecific(input.territory, lived, input.parentStatement)) return "";
  if (becauseConnector(`${input.territory} ${input.parentStatement}`) === "karena" && becauseConnector(lived) !== "karena") {
    return "";
  }
  const sentence = territoryAreaSentence(lived, `${input.territory} ${input.parentStatement} ${lived}`);
  if (!territorySceneIsSpecific(input.territory, sentence, input.parentStatement)) return "";
  return sentence;
}

function asQuestion(value: string): string {
  const text = plain(value).replace(/[?？]+$/g, "").trim();
  if (!text || /^(?:karena|because)\b/i.test(text)) return "";
  const first = text.charAt(0);
  const headed = first === first.toUpperCase() ? text : first.toUpperCase() + text.slice(1);
  return `${headed}?`;
}

/** The question asked in this area. The Big Thought is the answer, so the question must not copy it. */
export function parseTerritoryQuestion(
  script: string | null,
  input: { territory: string; parentStatement: string; masterStatement?: string },
): string {
  if (!script?.trim()) return "";
  const parsed = parseModelJson(script);
  const raw =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { question?: unknown }).question
      : "";
  const question = typeof raw === "string" ? asQuestion(raw) : "";
  if (!question || question.length > 180) return "";
  const parent = plain(input.parentStatement);
  if (parent && question.toLowerCase().includes(parent.toLowerCase())) return "";
  if (sameText(question, input.territory) || sameText(question, parent)) return "";
  if (becauseConnector(`${input.territory} ${parent}`) === "karena" && becauseConnector(question) !== "karena") return "";
  const master = plain(input.masterStatement ?? "");
  if (master && (sameText(question, master) || question.toLowerCase().includes(master.toLowerCase()))) return "";
  const yesNo = /^(?:apakah|does|is|are|do|can|could)\b/i.test(question);
  if (master && yesNo && repeatsMasterConclusion(question, master)) return "";
  return question;
}

export async function writeTerritoryAreaSentence(input: {
  territory: string;
  parentStatement: string;
  masterStatement?: string;
  audience?: string;
  answeredQuestion?: string;
  siblings?: string[];
  ask: (prompt: string) => Promise<string | null>;
}): Promise<{ sentence: string; question: string }> {
  const script = await input.ask(
    buildTerritoryLivedPrompt({
      territory: input.territory,
      parentStatement: input.parentStatement,
      masterStatement: input.masterStatement,
      audience: input.audience,
      answeredQuestion: input.answeredQuestion,
      siblings: input.siblings,
    }),
  );
  const scope = {
    territory: input.territory,
    parentStatement: input.parentStatement,
    masterStatement: input.masterStatement,
  };
  return { sentence: parseTerritoryLived(script, scope), question: parseTerritoryQuestion(script, scope) };
}
