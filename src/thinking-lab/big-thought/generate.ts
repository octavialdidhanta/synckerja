import { asBecauseClause } from "@/thinking-lab/big-thought/because";
import { normalizeBigThoughtLabel } from "@/thinking-lab/big-thought/label";
import { ACTIVE_SET_CAP, MAX_GENERATE_ROUNDS, TARGET_GENERATE_VALID } from "@/thinking-lab/shared/limits";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { judgeBigThought } from "@/thinking-lab/big-thought/semantic";
import type { BigThoughtFacts, GenerateMode, MissingWhy, SemanticExclusion } from "@/thinking-lab/big-thought/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

export type GeneratedBigThought = {
  label: string;
  statement: string;
};

export type PlannedGenerate = {
  needed: number;
  mode: GenerateMode | null;
  stop: null | "ENOUGH" | "CAP" | "ROUNDS";
  missingWhy: MissingWhy | null;
};

export function planGenerate(input: {
  activeCount: number;
  generateValidCount: number;
  round: number;
  missingWhy: MissingWhy | null;
}): PlannedGenerate {
  if (input.round > MAX_GENERATE_ROUNDS) {
    return { needed: 0, mode: null, stop: "ROUNDS", missingWhy: input.missingWhy };
  }
  if (input.activeCount >= ACTIVE_SET_CAP) {
    return { needed: 0, mode: null, stop: "CAP", missingWhy: input.missingWhy };
  }
  const room = ACTIVE_SET_CAP - input.activeCount;
  if (input.missingWhy) {
    return { needed: Math.min(1, room), mode: "gap", stop: null, missingWhy: input.missingWhy };
  }
  const missing = TARGET_GENERATE_VALID - input.generateValidCount;
  if (missing <= 0) {
    return { needed: 0, mode: null, stop: "ENOUGH", missingWhy: null };
  }
  return { needed: Math.min(missing, room), mode: "fill", stop: null, missingWhy: null };
}

export function countGenerateValid(rows: Array<{ admission: IndividualAdmission }>): number {
  return rows.filter((row) => row.admission === "GENERATE_VALID").length;
}

export function nextBigThoughtCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const match = /^BT(\d+)$/i.exec(code.trim());
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return `BT${String(max + 1).padStart(2, "0")}`;
}

function incumbentLines(rows: Array<{ code: string; statement: string; reasonContribution?: string | null }>): string {
  if (rows.length === 0) return "(none)";
  return rows
    .map((row) => {
      const contribution = row.reasonContribution?.trim() ?? "";
      return contribution
        ? `${row.code}: ${row.statement}\nReason contribution: ${contribution}`
        : `${row.code}: ${row.statement}`;
    })
    .join("\n");
}

function exclusionLines(entries: SemanticExclusion[]): string {
  if (entries.length === 0) return "(none)";
  return entries
    .map((entry) => {
      const lines = [
        entry.codes.length > 0 ? `Codes: ${entry.codes.join(", ")}` : "",
        entry.reasonContribution.trim() ? `Reason contribution: ${entry.reasonContribution.trim()}` : "",
        entry.explanation.trim() ? `Overlap explanation: ${entry.explanation.trim()}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function buildGeneratePrompt(input: {
  parentStatement: string;
  incumbents: Array<{ code: string; statement: string; reasonContribution?: string | null }>;
  needed: number;
  missingWhy: MissingWhy | null;
  exclusions?: SemanticExclusion[];
  failed?: { code: string; statement: string; reasonContribution?: string | null } | null;
}): string {
  const kept = incumbentLines(input.incumbents);
  const gap = input.missingWhy
    ? [
        "Search only for this missing because-clause.",
        `Description: ${input.missingWhy.description}`,
        `Boundary: ${input.missingWhy.boundary}`,
        "Do not search for a different support.",
        "The candidate must not restate the Master Thought or an incumbent Big Thought.",
      ].join("\n")
    : "Search for a because-clause that is not already in the incumbent list.";
  const exclusionSearch =
    input.exclusions === undefined
      ? []
      : [
          "You are looking for another because-clause.",
          "These reasoning jobs are already occupied.",
          "These reasoning spaces have already been found to collide.",
          "Do not merely reword, reframe, generalize, specialize, or change the emphasis of those same reasoning jobs.",
          "Search for a genuinely different because-clause that finishes the Master Thought.",
          "Different wording is not sufficient.",
          "Different subject vocabulary is not sufficient.",
          "The candidate must perform a genuinely different explanatory job.",
          "",
          "Occupied incumbent reasoning jobs:",
          kept,
          "",
          "Failed row being replaced:",
          input.failed ? incumbentLines([input.failed]) : "(none)",
          "",
          "Known semantic exclusions:",
          exclusionLines(input.exclusions),
        ];
  return [
    "Write Big Thought candidates for the confirmed Master Thought.",
    "Each candidate is only the clause that follows because. Inserting the word because between the Master Thought and the candidate must already make one sentence.",
    "The clause finishes the belief that is already there, including its comparison. It does not open a new claim.",
    "Do not repeat the Master Thought. Do not start the clause with because.",
    "One candidate is one foundational reason. It should feel awkward as a noun phrase and awkward as an observation that begins from what is rarely noticed.",
    "Prefer materially different reasons rather than multiple clauses that say the same thing.",
    "Do not restate or elaborate the Master Thought. Do not offer a method, tactic, execution, or a weak example.",
    "Do not offer an outcome, a consequence, or a standalone sentence about a new mechanism.",
    "Search for the missing because-clause, not a sentence that already repeats the Master Thought.",
    "Do not invent a weak statement to fill a quota. Return fewer statements when a strong support is not available.",
    "Keep every incumbent. Do not rewrite them.",
    "Write the statements in the same language as the Master Thought.",
    "Each item also has a label: a heading of 1 to 3 words that names the core of that statement.",
    "The label is not a new Big Thought. Do not shorten or rewrite the statement so that it matches the label.",
    "Write the label in the same language as the statement.",
    "Do not use examples from any specific industry, belief system, or brand.",
    gap,
    ...exclusionSearch,
    `Return at most ${input.needed} item(s).`,
    "Return JSON only: {\"items\":[{\"label\":\"1 to 3 words\",\"statement\":\"...\"}]}",
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Incumbent Big Thoughts:",
    kept,
  ].join("\n");
}

export function parseGeneratedBigThoughts(raw: unknown, parentStatement = ""): GeneratedBigThought[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const record = raw as { items?: unknown; statements?: unknown };
  if (Array.isArray(record.items)) {
    return record.items.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const statement = (row as { statement?: unknown }).statement;
      const label = (row as { label?: unknown }).label;
      if (typeof statement !== "string" || !statement.trim()) return [];
      return [
        {
          statement: asBecauseClause(statement, parentStatement),
          label: normalizeBigThoughtLabel(typeof label === "string" ? label : ""),
        },
      ];
    });
  }
  if (!Array.isArray(record.statements)) return [];
  return record.statements
    .filter((row): row is string => typeof row === "string" && row.trim().length > 0)
    .map((statement) => ({ statement: asBecauseClause(statement, parentStatement), label: "" }));
}

export function parseGeneratedStatements(raw: unknown, parentStatement = ""): string[] {
  return parseGeneratedBigThoughts(raw, parentStatement).map((row) => row.statement);
}

export type GenerateRunResult = {
  outcome: "READY" | "INSUFFICIENT_VALID_BIG_THOUGHTS";
  generateValid: number;
  target: number;
};

export async function runGenerateRounds<T extends { code: string; statement: string; admission: IndividualAdmission }>(input: {
  parentStatement: string;
  incumbents: T[];
  activeCount: number;
  missingWhy: MissingWhy | null;
  propose: (plan: PlannedGenerate, incumbents: T[]) => Promise<GeneratedBigThought[]>;
  judge: (
    statement: string,
    siblings: Array<{ code: string; statement: string }>,
  ) => Promise<BigThoughtFacts>;
  persist: (candidate: GeneratedBigThought, facts: BigThoughtFacts) => Promise<T>;
}): Promise<GenerateRunResult & { incumbents: T[] }> {
  let incumbents = [...input.incumbents];
  let activeCount = input.activeCount;
  for (let round = 1; round <= MAX_GENERATE_ROUNDS; round += 1) {
    const plan = planGenerate({
      activeCount,
      generateValidCount: countGenerateValid(incumbents),
      round,
      missingWhy: input.missingWhy,
    });
    if (plan.needed === 0) break;
    const proposed = await input.propose(plan, incumbents);
    const batch = plan.mode === "gap" ? proposed.slice(0, 1) : proposed.slice(0, plan.needed);
    let addedGap = false;
    for (const candidate of batch) {
      if (activeCount >= ACTIVE_SET_CAP) break;
      const siblings = incumbents
        .filter((row) => row.admission === "GENERATE_VALID")
        .map((row) => ({ code: row.code, statement: row.statement }));
      const facts = await input.judge(candidate.statement, siblings);
      const admission = individualAdmission({ facts, factsCurrent: true });
      const saved = await input.persist(candidate, facts);
      incumbents = [...incumbents, { ...saved, admission }];
      activeCount += 1;
      addedGap = plan.mode === "gap" && admission === "GENERATE_VALID";
    }
    if (addedGap) break;
    if (!input.missingWhy && countGenerateValid(incumbents) >= TARGET_GENERATE_VALID) break;
  }
  const generateValid = countGenerateValid(incumbents);
  const filled = input.missingWhy ? generateValid > countGenerateValid(input.incumbents) : generateValid >= TARGET_GENERATE_VALID;
  return {
    outcome: filled ? "READY" : "INSUFFICIENT_VALID_BIG_THOUGHTS",
    generateValid,
    target: input.missingWhy ? countGenerateValid(input.incumbents) + 1 : TARGET_GENERATE_VALID,
    incumbents,
  };
}

export async function judgeCandidateWithAsk(input: {
  parentStatement: string;
  statement: string;
  code: string;
  siblings: Array<{ code: string; statement: string }>;
  ask: (prompt: string, temperature?: 0 | 0.2) => Promise<string | null>;
}): Promise<BigThoughtFacts> {
  return judgeBigThought(
    {
      parentStatement: input.parentStatement,
      candidate: { code: input.code, statement: input.statement },
      siblings: input.siblings,
    },
    (prompt) => input.ask(prompt, 0),
  );
}
