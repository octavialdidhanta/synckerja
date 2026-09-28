import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { judgeExecution } from "@/thinking-lab/execution/semantic";
import { EXECUTION_PILLARS, type ExecutionPillar, type ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

export function buildExecutionGeneratePrompt(input: {
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  pillar: ExecutionPillar;
  ancestors?: AncestorStake[];
}): string {
  const pillarLabel = EXECUTION_PILLARS.find((item) => item.id === input.pillar)?.label ?? input.pillar;
  return [
    "Write one piece of content for one locked Idea and one pillar.",
    "The pillar is a format. It is not a new belief, territory, angle, or idea.",
    `Pillar: ${pillarLabel}.`,
    "Do not add a claim the Idea does not already carry.",
    "A viewer must be able to see the Idea's mechanism and climb to the named Master Thought subject.",
    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
    "Do not force a message outside the Idea.",
    "Use Flash Sale Hook only when the Master Thought is actually selling something. Otherwise still describe the format, and do not invent a sale.",
    ...ANCESTOR_STAKE_RULES,
    "Write in the same language as the Idea.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"statement\":\"...\"}",
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
  ].join("\n");
}

export function parseExecutionStatement(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const statement = (raw as { statement?: unknown }).statement;
  return typeof statement === "string" ? statement.trim() : "";
}

export async function judgeAndSealExecution(input: {
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  pillar: ExecutionPillar;
  ancestors?: AncestorStake[];
  statement: string;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<ExecutionSemanticFacts> {
  return judgeExecution(
    {
      masterStatement: input.masterStatement,
      masterSubject: input.masterSubject,
      ideaStatement: input.ideaStatement,
      pillar: input.pillar,
      ancestors: input.ancestors,
      candidate: input.statement,
    },
    input.ask,
  );
}
