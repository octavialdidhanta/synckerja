import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ThinkingWriteResult } from "../../db/thinkingWrite";

const sentence = (max: number) => z.string().trim().min(1).max(max);

const catalogNames = z.array(z.string().trim().min(1).max(200)).max(20);

export const masterCreateInput = z.object({
  belief: sentence(400),
  prior_belief: sentence(400),
  audience: z.string().trim().max(400).optional(),
  catalog: z.string().trim().min(1).max(200),
  sub_categories: catalogNames.optional(),
  features: catalogNames.optional(),
}).strict();

export const masterCatalogSetInput = z.object({
  master_thought_id: z.string().uuid(),
  catalog: z.string().trim().min(1).max(200),
  sub_categories: catalogNames.optional(),
  features: catalogNames.optional(),
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

export const angleAddInput = z.object({
  territory_id: z.string().uuid(),
  statement: sentence(500),
  subject: sentence(120),
  example: sentence(300),
}).strict();

export const angleLockInput = z.object({
  territory_id: z.string().uuid(),
}).strict();

export type AngleAddWrite = { territoryId: string; statement: string; subject: string; example: string };
export type AngleLockWrite = { territoryId: string };

export function angleAddResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  add: (ctx: McpAuthContext, input: AngleAddWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = angleAddInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return add(ctx, {
    territoryId: parsed.data.territory_id,
    statement: parsed.data.statement,
    subject: parsed.data.subject,
    example: parsed.data.example,
  });
}

export function angleLockResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  lock: (ctx: McpAuthContext, input: AngleLockWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = angleLockInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return lock(ctx, { territoryId: parsed.data.territory_id });
}

export const ideaAddInput = z.object({
  angle_id: z.string().uuid(),
  statement: sentence(600),
  subject: z.string().trim().max(120).optional(),
  keys: z.array(z.object({
    other_explanation: sentence(300),
    close: sentence(300),
  }).strict()).min(1).max(5),
}).strict();

export type IdeaAddWrite = {
  angleId: string;
  statement: string;
  subject: string;
  keys: Array<{ otherExplanation: string; close: string }>;
};

export function ideaAddResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  add: (ctx: McpAuthContext, input: IdeaAddWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = ideaAddInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return add(ctx, {
    angleId: parsed.data.angle_id,
    statement: parsed.data.statement,
    subject: parsed.data.subject ?? "",
    keys: parsed.data.keys.map((key) => ({ otherExplanation: key.other_explanation, close: key.close })),
  });
}

export type CatalogPick = { catalog: string; subCategories: string[]; features: string[] };
export type MasterCreateWrite = { belief: string; priorBelief: string; audience: string } & CatalogPick;
export type MasterCatalogWrite = { masterThoughtId: string } & CatalogPick;
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
    subCategories: parsed.data.sub_categories ?? [],
    features: parsed.data.features ?? [],
  });
}

export function masterCatalogSetResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  set: (ctx: McpAuthContext, input: MasterCatalogWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = masterCatalogSetInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return set(ctx, {
    masterThoughtId: parsed.data.master_thought_id,
    catalog: parsed.data.catalog,
    subCategories: parsed.data.sub_categories ?? [],
    features: parsed.data.features ?? [],
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
