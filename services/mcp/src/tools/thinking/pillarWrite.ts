import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ThinkingWriteResult } from "../../db/thinkingWrite";
import type { PillarCard } from "../../db/thinkingPillar";

const text = (max: number) => z.string().trim().min(1).max(max);

export const ideaLockInput = z.object({ angle_id: z.string().uuid() }).strict();
export type IdeaLockWrite = { angleId: string };

export const pillarsRecommendInput = z.object({ idea_id: z.string().uuid() }).strict();
export type PillarsRecommendRead = { ideaId: string };
export type PillarsRecommendResult = { chosen: PillarCard[]; recommendations: PillarCard[] };

export const pillarSetInput = z.object({
  idea_id: z.string().uuid(),
  content_pillar_id: z.string().uuid(),
  development: text(1500),
  reason: text(600),
}).strict();
export type PillarSetWrite = { ideaId: string; contentPillarId: string; development: string; reason: string };

export const pillarRemoveInput = z.object({
  idea_id: z.string().uuid(),
  content_pillar_id: z.string().uuid(),
}).strict();
export type PillarRemoveWrite = { ideaId: string; contentPillarId: string };

export type PillarWriteResult = ThinkingWriteResult & { pillars?: PillarCard[] };

export function ideaLockResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  lock: (ctx: McpAuthContext, input: IdeaLockWrite) => Promise<ThinkingWriteResult>,
): Promise<ThinkingWriteResult> {
  const parsed = ideaLockInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return lock(ctx, { angleId: parsed.data.angle_id });
}

export function pillarsRecommendResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  recommend: (ctx: McpAuthContext, input: PillarsRecommendRead) => Promise<PillarsRecommendResult>,
): Promise<PillarsRecommendResult> {
  const parsed = pillarsRecommendInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return recommend(ctx, { ideaId: parsed.data.idea_id });
}

export function pillarSetResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  set: (ctx: McpAuthContext, input: PillarSetWrite) => Promise<PillarWriteResult>,
): Promise<PillarWriteResult> {
  const parsed = pillarSetInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return set(ctx, {
    ideaId: parsed.data.idea_id,
    contentPillarId: parsed.data.content_pillar_id,
    development: parsed.data.development,
    reason: parsed.data.reason,
  });
}

export function pillarRemoveResult(
  ctx: McpAuthContext,
  args: Record<string, unknown>,
  remove: (ctx: McpAuthContext, input: PillarRemoveWrite) => Promise<PillarWriteResult>,
): Promise<PillarWriteResult> {
  const parsed = pillarRemoveInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return remove(ctx, { ideaId: parsed.data.idea_id, contentPillarId: parsed.data.content_pillar_id });
}
