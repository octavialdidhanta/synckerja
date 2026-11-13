import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ThinkingWriteResult } from "../../db/thinkingWrite";

const sentence = (max: number) => z.string().trim().min(1).max(max);

export const masterCreateInput = z.object({
  belief: sentence(400),
  prior_belief: sentence(400),
  audience: z.string().trim().max(400).optional(),
  catalog: z.string().trim().max(200).optional(),
}).strict();

export const masterCatalogSetInput = z.object({
  master_thought_id: z.string().uuid(),
  catalog: z.string().trim().max(200),
}).strict();

export const bigThoughtAddInput = z.object({
  master_thought_id: z.string().uuid(),
  statement: sentence(500),
  label: z.string().trim().max(80).optional(),
}).strict();

export const bigThoughtLockInput = z.object({
  master_thought_id: z.string().uuid(),
}).strict();

export type BigThoughtLockWrite = { masterThoughtId: string };

export function bigThoughtLockResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  lock: (ctx: McpAuthContext, input: BigThoughtLockWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = bigThoughtLockInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return lock(ctx, { masterThoughtId: parsed.data.master_thought_id });
}

export const territoryAddInput = z.object({
  big_thought_id: z.string().uuid(),
  statement: sentence(120),
}).strict();

export const territoryLockInput = z.object({
  big_thought_id: z.string().uuid(),
}).strict();

export type TerritoryAddWrite = { bigThoughtId: string; statement: string };
export type TerritoryLockWrite = { bigThoughtId: string };

export function territoryAddResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  add: (ctx: McpAuthContext, input: TerritoryAddWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = territoryAddInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return add(ctx, { bigThoughtId: parsed.data.big_thought_id, statement: parsed.data.statement });
}

export function territoryLockResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  lock: (ctx: McpAuthContext, input: TerritoryLockWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = territoryLockInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return lock(ctx, { bigThoughtId: parsed.data.big_thought_id });
}

export type MasterCreateWrite = { belief: string; priorBelief: string; audience: string; catalog?: string };
export type MasterCatalogWrite = { masterThoughtId: string; catalog: string };
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
    catalog: parsed.data.catalog,
  });
}

export function masterCatalogSetResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  set: (ctx: McpAuthContext, input: MasterCatalogWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = masterCatalogSetInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return set(ctx, { masterThoughtId: parsed.data.master_thought_id, catalog: parsed.data.catalog });
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
