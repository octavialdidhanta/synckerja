import type { McpAuthContext } from "../../authz/context";
import type { ThinkingPlanResult } from "../../db/thinkingLab";
import { planDirectInput, type ThinkingPlanFields, type ThinkingScriptDraft } from "./scriptInput";

export { planDirectInput };

export type ThinkingPlanDirectInput = {
  ideaId: string;
  contentPillarId: string;
  script: ThinkingScriptDraft;
} & ThinkingPlanFields;

export function planDirectResult(
  ctx: McpAuthContext,
  raw: unknown,
  save: (ctx: McpAuthContext, input: ThinkingPlanDirectInput) => Promise<ThinkingPlanResult>,
): Promise<ThinkingPlanResult> {
  const parsed = planDirectInput.safeParse(raw);
  if (!parsed.success) throw new Error("invalid_input");
  return save(ctx, {
    ideaId: parsed.data.idea_id,
    contentPillarId: parsed.data.content_pillar_id,
    script: parsed.data.script,
    contentTypeId: parsed.data.content_type_id,
    serviceId: parsed.data.service_id ?? null,
    subServiceId: parsed.data.sub_service_id ?? null,
    featureId: parsed.data.feature_id ?? null,
    postDate: parsed.data.post_date ?? null,
  });
}
