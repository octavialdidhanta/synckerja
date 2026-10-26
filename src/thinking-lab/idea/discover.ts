import type { IdeaDecision, IdeaDiscovery } from "@/thinking-lab/idea/setAudit";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";

export type IdeaDiscoveryQuestion = {
  id: string;
  category: string;
  prompt: string;
  options: string[];
};

export type IdeaDiscoveryResult = { ok: true; questions: IdeaDiscoveryQuestion[] } | { ok: false };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function clean(value: unknown, limit: number): string {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!text || text.length > limit) return "";
  return text;
}

export function ideaDiscoveryMatches(
  discovery: IdeaDiscovery | null | undefined,
  angleFingerprint: string | null | undefined,
): discovery is IdeaDiscovery {
  const fingerprint = angleFingerprint?.trim() ?? "";
  if (!discovery || !fingerprint) return false;
  return discovery.angleFingerprint === fingerprint;
}

export function ideaWorldLines(decisions: IdeaDecision[] | null | undefined): string[] {
  const rows = (decisions ?? []).filter((row) => row.question.trim() && row.answer.trim());
  if (rows.length === 0) {
    return [
      "Stay inside the situation the chain already states.",
      "Do not invent a setting the chain does not contain.",
    ];
  }
  return [
    "These choices are locked. Do not reopen them.",
    ...rows.flatMap((row) => [
      `The mechanisms live in this world: "${row.answer.trim()}".`,
      `The question was: ${row.question.trim()}`,
      "Write every Idea inside that world.",
    ]),
    "Each Idea is still a different mechanism. Do not repeat a mechanism by changing only a prop, a title, or a small detail.",
  ];
}

export function buildIdeaDiscoveryPrompt(input: {
  masterStatement: string;
  masterSubject?: string;
  priorBelief?: string;
  angleStatement: string;
  ancestors?: AncestorStake[];
}): string {
  return [
    "Before any Idea is written, read the chain from the Master Thought through the Angle until the situation is clear.",
    "Do not write an Idea.",
    "An open choice is a choice that would place the mechanisms in two different worlds.",
    "A world is a concrete situation already implied by the chain. Each option names a person, a place, or a condition already present in that text.",
    "When the chain is a general human situation and does not discuss a business problem, stay inside that situation. Conclude that from the text. The options stay inside that situation.",
    "Do not lock one scene, one prop, or one mechanism. Later Ideas remain different mechanisms inside the same world.",
    "Return as many questions as there are open world choices. Zero is allowed. More than three are not used.",
    "Each question has a short category, a prompt in the Angle's language, and two to four options.",
    "Return JSON only:",
    JSON.stringify({ questions: [{ category: "", prompt: "", options: ["", ""] }] }),
    "",
    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
    "Master Thought:",
    input.masterStatement.trim(),
    ...(input.priorBelief?.trim() ? ["", "Old belief:", input.priorBelief.trim()] : []),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Angle:",
    input.angleStatement.trim(),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function parseIdeaDiscoveryQuestions(raw: unknown): IdeaDiscoveryResult {
  const row = asRecord(raw);
  if (!row || !Array.isArray(row.questions)) return { ok: false };
  const seenOptions = new Set<string>();
  const seenPrompts = new Set<string>();
  const questions: IdeaDiscoveryQuestion[] = [];
  for (const item of row.questions) {
    const questionRow = asRecord(item);
    if (!questionRow) continue;
    const prompt = clean(questionRow.prompt ?? questionRow.question, 240);
    const category = clean(questionRow.category, 80) || prompt.slice(0, 80);
    if (!prompt || !category) continue;
    const options = [
      ...new Set((Array.isArray(questionRow.options) ? questionRow.options : []).map((option) => clean(option, 160)).filter(Boolean)),
    ].slice(0, 4);
    if (options.length < 2) continue;
    const signature = options.map((option) => option.toLowerCase()).sort().join("|");
    const promptKey = prompt.toLowerCase();
    if (seenOptions.has(signature) || seenPrompts.has(promptKey)) continue;
    seenOptions.add(signature);
    seenPrompts.add(promptKey);
    questions.push({ id: `q${questions.length + 1}`, category, prompt, options });
    if (questions.length === 3) break;
  }
  return { ok: true, questions };
}
