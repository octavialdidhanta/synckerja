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

export function territoryDescriptions(territory: string, lived = "", parentReason = ""): TerritoryDescriptions {
  const name = plain(territory);
  if (!name || !territorySceneIsSpecific(name, lived, parentReason)) return empty;
  return {
    areaLead: "",
    area: asSentence(lived),
    passLead: "",
    pass: "",
  };
}

export function buildTerritoryLivedPrompt(input: {
  territory: string;
  parentStatement: string;
  audience?: string;
}): string {
  const language = becauseConnector(`${input.territory} ${input.parentStatement}`) === "karena" ? "Indonesian" : "English";
  const people = input.audience?.trim();
  return [
    "Write one sentence that explains this Territory as a situation people are already in.",
    `Write it in ${language}.`,
    people ? `Use words this audience would use: ${people}.` : "Use words the audience would use for this area.",
    "Say what is happening in this named area. A different Territory must not be able to reuse the same sentence.",
    "Do not quote, translate, or paraphrase the Big Thought.",
    "Do not answer with only the Territory name.",
    "Do not start with Di or In plus the Territory name.",
    "Do not use the frame 'ini yang orang hadapi' or 'this is what people run into'.",
    "Do not write a because-clause, a slogan, or a belief.",
    'Return JSON only: {"lived":"..."}',
    "",
    `Territory: ${input.territory.trim()}`,
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
  return asSentence(lived);
}
