import type { McpAuthContext } from "../../authz/context";
import type { ThinkingPlanResult } from "../../db/thinkingLab";
import { planSaveInput, type ThinkingPlanFields } from "./scriptInput";

export { planSaveInput };

export type ThinkingPlanSaveInput = { executionId: string } & ThinkingPlanFields;

export function planSaveResult(
  ctx: McpAuthContext,
  raw: unknown,
  save: (ctx: McpAuthContext, input: ThinkingPlanSaveInput) => Promise<ThinkingPlanResult>,
): Promise<ThinkingPlanResult> {
  const parsed = planSaveInput.safeParse(raw);
  if (!parsed.success) throw new Error("invalid_input");
  return save(ctx, {
    executionId: parsed.data.execution_id,
    contentTypeId: parsed.data.content_type_id,
    serviceId: parsed.data.service_id ?? null,
    subServiceId: parsed.data.sub_service_id ?? null,
    featureId: parsed.data.feature_id ?? null,
    postDate: parsed.data.post_date ?? null,
  });
}
