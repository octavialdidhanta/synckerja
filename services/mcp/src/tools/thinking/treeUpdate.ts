import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ThinkingWriteResult } from "../../db/thinkingWrite";

const sentence = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().uuid();

export const masterUpdateInput = z.object({
  master_thought_id: id,
  belief: sentence(500).optional(),
  prior_belief: sentence(500).optional(),
  audience: z.string().trim().max(300).optional(),
}).strict();

export const bigThoughtUpdateInput = z.object({
  master_thought_id: id,
  big_thought_id: id,
  statement: sentence(500),
  label: z.string().trim().max(80).optional(),
}).strict();

export const territoryUpdateInput = z.object({
  master_thought_id: id,
  territory_id: id,
  statement: sentence(200),
}).strict();

export const angleUpdateInput = z.object({
  master_thought_id: id,
  angle_id: id,
  statement: sentence(500),
  subject: sentence(120),
  example: sentence(300),
}).strict();

export const ideaUpdateInput = z.object({
  master_thought_id: id,
  idea_id: id,
  statement: sentence(600),
  subject: z.string().trim().max(120).optional(),
  keys: z.array(z.object({ other_explanation: sentence(300), close: sentence(300) }).strict()).min(1).max(5),
}).strict();

export type MasterUpdateWrite = { masterThoughtId: string; belief?: string; priorBelief?: string; audience?: string };
export type BigThoughtUpdateWrite = { masterThoughtId: string; bigThoughtId: string; statement: string; label?: string };
export type TerritoryUpdateWrite = { masterThoughtId: string; territoryId: string; statement: string };
export type AngleUpdateWrite = { masterThoughtId: string; angleId: string; statement: string; subject: string; example: string };
export type IdeaUpdateWrite = {
  masterThoughtId: string;
  ideaId: string;
  statement: string;
  subject: string;
  keys: Array<{ otherExplanation: string; close: string }>;
};

type Run<T> = (ctx: McpAuthContext, input: T) => Promise<ThinkingWriteResult>;

export function masterUpdateResult(ctx: McpAuthContext, args: Record<string, unknown>, run: Run<MasterUpdateWrite>) {
  const parsed = masterUpdateInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  if (parsed.data.belief === undefined && parsed.data.prior_belief === undefined && parsed.data.audience === undefined) {
    throw new Error("invalid_input");
  }
  return run(ctx, {
    masterThoughtId: parsed.data.master_thought_id,
    ...(parsed.data.belief !== undefined ? { belief: parsed.data.belief } : {}),
    ...(parsed.data.prior_belief !== undefined ? { priorBelief: parsed.data.prior_belief } : {}),
    ...(parsed.data.audience !== undefined ? { audience: parsed.data.audience } : {}),
  });
}

export function bigThoughtUpdateResult(ctx: McpAuthContext, args: Record<string, unknown>, run: Run<BigThoughtUpdateWrite>) {
  const parsed = bigThoughtUpdateInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return run(ctx, {
    masterThoughtId: parsed.data.master_thought_id,
    bigThoughtId: parsed.data.big_thought_id,
    statement: parsed.data.statement,
    ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
  });
}

export function territoryUpdateResult(ctx: McpAuthContext, args: Record<string, unknown>, run: Run<TerritoryUpdateWrite>) {
  const parsed = territoryUpdateInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return run(ctx, {
    masterThoughtId: parsed.data.master_thought_id,
    territoryId: parsed.data.territory_id,
    statement: parsed.data.statement,
  });
}

export function angleUpdateResult(ctx: McpAuthContext, args: Record<string, unknown>, run: Run<AngleUpdateWrite>) {
  const parsed = angleUpdateInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return run(ctx, {
    masterThoughtId: parsed.data.master_thought_id,
    angleId: parsed.data.angle_id,
    statement: parsed.data.statement,
    subject: parsed.data.subject,
    example: parsed.data.example,
  });
}

export function ideaUpdateResult(ctx: McpAuthContext, args: Record<string, unknown>, run: Run<IdeaUpdateWrite>) {
  const parsed = ideaUpdateInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return run(ctx, {
    masterThoughtId: parsed.data.master_thought_id,
    ideaId: parsed.data.idea_id,
    statement: parsed.data.statement,
    subject: parsed.data.subject ?? "",
    keys: parsed.data.keys.map((key) => ({ otherExplanation: key.other_explanation, close: key.close })),
  });
}
