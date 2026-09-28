import { judgeBigThought } from "@/thinking-lab/big-thought/semantic";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import type { BigThoughtFacts } from "@/thinking-lab/big-thought/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

/** Same candidate code Generate uses for an unsaved individual judgment. */
export const DIAGNOSTIC_CANDIDATE_CODE = "NEW";

export type ManualSemanticDiagnosticResult = {
  statement: string;
  facts: BigThoughtFacts;
  admission: IndividualAdmission;
};

export async function diagnoseBigThought(input: {
  parentStatement: string;
  candidate: string;
  siblings: Array<{ code: string; statement: string }>;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<ManualSemanticDiagnosticResult> {
  const statement = input.candidate.trim();
  const facts = await judgeBigThought(
    {
      parentStatement: input.parentStatement,
      candidate: { code: DIAGNOSTIC_CANDIDATE_CODE, statement },
      siblings: input.siblings,
    },
    input.ask,
  );
  return {
    statement,
    facts,
    admission: individualAdmission({ facts, factsCurrent: true }),
  };
}
