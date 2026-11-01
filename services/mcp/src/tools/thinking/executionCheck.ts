import type { McpAuthContext } from "../../authz/context";
import type { ThinkingCheckResult } from "../../db/thinkingLab";
import { executionCheckInput, type ThinkingScriptDraft } from "./scriptInput";

export { executionCheckInput };

export type ThinkingCheckInput = {
  ideaId: string;
  contentPillarId: string;
  script: ThinkingScriptDraft;
};

export function executionCheckResult(
  ctx: McpAuthContext,
  raw: unknown,
  run: (ctx: McpAuthContext, input: ThinkingCheckInput) => Promise<ThinkingCheckResult>,
): Promise<ThinkingCheckResult> {
  const parsed = executionCheckInput.safeParse(raw);
  if (!parsed.success) throw new Error("invalid_input");
  return run(ctx, {
    ideaId: parsed.data.idea_id,
    contentPillarId: parsed.data.content_pillar_id,
    script: parsed.data.script,
  });
}
