import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ThinkingWriteResult } from "../../db/thinkingWrite";

const sentence = (max: number) => z.string().trim().min(1).max(max);

export const masterCreateInput = z.object({
  belief: sentence(400),
  prior_belief: sentence(400),
  audience: z.string().trim().max(400).optional(),
}).strict();

export const bigThoughtAddInput = z.object({
  master_thought_id: z.string().uuid(),
  statement: sentence(500),
  label: z.string().trim().max(80).optional(),
}).strict();

export type MasterCreateWrite = { belief: string; priorBelief: string; audience: string };
export type BigThoughtAddWrite = { masterThoughtId: string; statement: string; label: string };

export function masterCreateResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  create: (ctx: McpAuthContext, input: MasterCreateWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = masterCreateInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return create(ctx, {
    belief: parsed.data.belief,
    priorBelief: parsed.data.prior_belief,
    audience: parsed.data.audience ?? "",
  });
}

export function bigThoughtAddResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  add: (ctx: McpAuthContext, input: BigThoughtAddWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = bigThoughtAddInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return add(ctx, {
    masterThoughtId: parsed.data.master_thought_id,
    statement: parsed.data.statement,
    label: parsed.data.label ?? "",
  });
}
