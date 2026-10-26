import type { CreativeFailureItem } from "@/thinking-lab/creative-idea/validation";
import { howIfInstruction } from "@/thinking-lab/idea/validation";
import { parseModelJson } from "@/thinking-lab/shared/ai";
import type { CreativeDraft, CreativeFormat } from "@/thinking-lab/creative-idea/types";
import { CREATIVE_BATCH } from "@/thinking-lab/creative-idea/types";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function nextCreativeCode(parentCode: string, existing: readonly string[]): string {
  const prefix = `${parentCode.trim().toUpperCase()}-CI`;
  let max = 0;
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`, "i");
  for (const code of existing) {
    const match = pattern.exec(code.trim());
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

export function creativeIdeaPromptLines(input?: {
  statement?: string | null;
  concept?: string | null;
  mechanism?: string | null;
  value?: string | null;
} | null): string[] {
  const statement = input?.statement?.trim() ?? "";
  if (!statement) return [];
  return [
    "Creative Idea. Realize this communication idea. Do not replace its core, and do not replace the conceptual idea.",
    statement,
    ...(input?.concept?.trim() ? [`Creative concept: ${input.concept.trim()}`] : []),
    ...(input?.mechanism?.trim() ? [`Creative mechanism: ${input.mechanism.trim()}`] : []),
    ...(input?.value?.trim() ? [`Creative value: ${input.value.trim()}`] : []),
  ];
}

export function buildCreativeGeneratePrompt(input: {
  parentCode: string;
  parentStatement: string;
  parentConcept: string;
  parentMechanism: string;
  parentValue: string;
  pillarName: string;
  format: CreativeFormat;
  masterThought: string;
  audience: string;
  priorBelief: string;
  rootBelief: string;
  bigThought: string;
  territory: string;
  angle: string;
  count?: number;
  failures?: readonly CreativeFailureItem[];
  existingStatements?: readonly string[];
  reviseOf?: { code: string; statement: string; recommendation: string } | null;
}): string {
  const count = input.reviseOf ? 1 : input.count ?? CREATIVE_BATCH;
  const failures = input.failures ?? [];
  return [
    "Write creative ideas for one conceptual idea, one selected pillar, and one selected format.",
    "A creative idea develops the conceptual idea through a specific communication idea and mechanism.",
    "It is not a title, topic, premise, script, hook, storyboard, pillar, format, or delivery technique without a core idea.",
    howIfInstruction(input.parentStatement),
    "Do not replace the conceptual idea's substance.",
    `Write ${count} alternative${count === 1 ? "" : "s"}.`,
    "Each alternative must differ in concept, working principle, or the value it produces.",
    "Do not write three title variations of the same mechanism.",
    "Return JSON only:",
    JSON.stringify({
      ideas: [{ title: "", statement: "", concept: "", mechanism: "", value: "" }],
    }),
    "",
    `Parent: ${input.parentCode.trim()}`,
    `Pillar: ${input.pillarName.trim()}`,
    `Format: ${input.format}`,
    "",
    "Conceptual idea:",
    input.parentStatement.trim(),
    ...(input.parentConcept.trim() ? [`Concept: ${input.parentConcept.trim()}`] : []),
    ...(input.parentMechanism.trim() ? [`Mechanism: ${input.parentMechanism.trim()}`] : []),
    ...(input.parentValue.trim() ? [`Value: ${input.parentValue.trim()}`] : []),
    "",
    "Master Thought:",
    input.masterThought.trim() || "(not stored)",
    `Audience: ${input.audience.trim() || "(not stored)"}`,
    `Prior belief: ${input.priorBelief.trim() || "(not stored)"}`,
    `Root belief: ${input.rootBelief.trim() || "(not stored)"}`,
    `Big Thought: ${input.bigThought.trim() || "(not stored)"}`,
    `Territory: ${input.territory.trim() || "(not stored)"}`,
    `Angle: ${input.angle.trim() || "(not stored)"}`,
    ...(input.existingStatements && input.existingStatements.length > 0
      ? ["", "Creative ideas already saved for this pillar and format. Do not repeat them:", ...input.existingStatements.map((line) => `- ${line}`)]
      : []),
    ...(failures.length > 0
      ? [
          "",
          "Creative-idea failures for this pillar and format. Do not repeat them. Do not change the conceptual idea:",
          ...failures.flatMap((item) => [
            `${item.code} (${item.decision}): ${item.statement}`,
            ...item.failed.map((failed) => `${failed.id}: ${failed.reason}`),
          ]),
        ]
      : []),
    ...(input.reviseOf
      ? ["", `Revise ${input.reviseOf.code} into one new creative idea. Keep the conceptual idea.`, input.reviseOf.statement, input.reviseOf.recommendation]
      : []),
  ].join("\n");
}

export function parseCreativeDrafts(raw: unknown, limit = CREATIVE_BATCH): CreativeDraft[] {
  const row = asRecord(raw);
  const list = Array.isArray(raw) ? raw : Array.isArray(row?.ideas) ? row.ideas : Array.isArray(row?.creativeIdeas) ? row.creativeIdeas : [];
  const seen = new Set<string>();
  return list.flatMap((item) => {
    const entry = asRecord(item);
    if (!entry) return [];
    const statement = asText(entry.statement ?? entry.creativeIdea ?? entry.idea);
    const key = statement.toLowerCase();
    if (!statement || seen.has(key)) return [];
    seen.add(key);
    return [
      {
        title: asText(entry.title),
        statement,
        concept: asText(entry.concept),
        mechanism: asText(entry.mechanism),
        value: asText(entry.value),
      },
    ];
  }).slice(0, limit);
}

export async function requestCreativeDrafts(input: {
  prompt: string;
  ask: (prompt: string) => Promise<string | null>;
  limit?: number;
}): Promise<CreativeDraft[]> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await input.ask(input.prompt);
    const drafts = parseCreativeDrafts(raw ? parseModelJson(raw) : null, input.limit ?? CREATIVE_BATCH);
    if (drafts.length > 0) return drafts;
  }
  return [];
}
