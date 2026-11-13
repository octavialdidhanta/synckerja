import type { SupabaseClient } from "@supabase/supabase-js";
import { reviewContentPillars, type ReviewablePillar } from "../../../../src/thinking-lab/creative-idea/recommend";
import { lockedPillarCards, readDevelopmentPaths, upsertDevelopmentPath } from "../../../../src/thinking-lab/creative-idea/paths";
import type { DevelopmentPath } from "../../../../src/thinking-lab/creative-idea/types";
import type { JudgeConfig } from "./thinkingLab";
import { makeAsk, rpcError, sessionArgs, type Deps, type Session, type ThinkingWriteResult } from "./thinkingWrite";

type ChainRow = {
  idea_id: string;
  idea_statement: string;
  master_statement: string;
  big_thought_statement: string;
  territory_statement: string;
  angle_statement: string;
  development_paths: unknown;
  pillars: Array<{ id: string; name: string; category?: string; description?: string }>;
};

export type PillarCard = { content_pillar_id: string; pillar_name: string; development: string; reason: string };

/** Only a locked Idea that passed has a chain; anything else is not_found. */
async function loadChain(admin: SupabaseClient, ctx: Session, ideaId: string): Promise<ChainRow> {
  const { data, error } = await admin.rpc("mcp_get_thinking_chain", { ...sessionArgs(ctx), p_idea_id: ideaId });
  if (error) rpcError(error);
  const row = Array.isArray(data) ? (data[0] as ChainRow | undefined) : (data as ChainRow | null);
  if (!row) throw new Error("not_found");
  return row;
}

function chainContext(chain: ChainRow): string {
  return [chain.master_statement, chain.big_thought_statement, chain.territory_statement, chain.angle_statement, chain.idea_statement]
    .map((text) => (text ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function cards(paths: readonly DevelopmentPath[]): PillarCard[] {
  return lockedPillarCards(paths).map((card) => ({
    content_pillar_id: card.contentPillarId,
    pillar_name: card.pillarName,
    development: card.development,
    reason: card.reason,
  }));
}

async function savePaths(admin: SupabaseClient, ctx: Session, ideaId: string, paths: DevelopmentPath[]): Promise<void> {
  const { error } = await admin.rpc("mcp_set_thinking_idea_paths", {
    ...sessionArgs(ctx),
    p_idea_id: ideaId,
    p_paths: JSON.parse(JSON.stringify(paths)) as unknown,
  });
  if (error) rpcError(error);
}

/** Up to three content pillars that fit this Idea, with how to develop it in each, like Review pillar on the page. Saves nothing. */
export async function recommendThinkingPillars(
  admin: SupabaseClient,
  config: JudgeConfig,
  ctx: Session,
  input: { ideaId: string },
  deps: Deps = {},
): Promise<{ chosen: PillarCard[]; recommendations: PillarCard[] }> {
  const chain = await loadChain(admin, ctx, input.ideaId);
  const paths = readDevelopmentPaths(chain.development_paths);
  const chosen = cards(paths);
  const pillars: ReviewablePillar[] = (chain.pillars ?? []).map((pillar) => ({
    id: pillar.id,
    name: pillar.name,
    category: pillar.category ?? null,
    description: pillar.description ?? null,
  }));
  const reviews = await reviewContentPillars({
    pillars,
    excludeIds: chosen.map((card) => card.content_pillar_id),
    keep: 3,
    context: chainContext(chain),
    ask: makeAsk(config, ctx, deps),
  });
  return {
    chosen,
    recommendations: reviews.map((review) => ({
      content_pillar_id: review.contentPillarId,
      pillar_name: review.pillarName,
      development: review.development,
      reason: review.reason,
    })),
  };
}

/**
 * Choose (or rewrite) one content pillar for a locked Idea, with how the Idea is developed in it.
 * Same record the page writes when a pillar is locked; Execution for that pillar can start after.
 */
export async function setThinkingPillar(
  admin: SupabaseClient,
  ctx: Session,
  input: { ideaId: string; contentPillarId: string; development: string; reason: string },
): Promise<ThinkingWriteResult & { pillars?: PillarCard[] }> {
  const development = input.development.replace(/\s+/g, " ").trim();
  const reason = input.reason.replace(/\s+/g, " ").trim();
  if (!development || !reason) throw new Error("invalid_input");
  const chain = await loadChain(admin, ctx, input.ideaId);
  const pillar = (chain.pillars ?? []).find((item) => item.id === input.contentPillarId);
  if (!pillar) {
    return { saved: false, failed: [{ check: "pillar", reason: "This content pillar is not active for this organization." }] };
  }
  const paths = readDevelopmentPaths(chain.development_paths);
  const review = { contentPillarId: pillar.id, pillarName: pillar.name, status: "RECOMMENDED" as const, reason, development };
  const previous = paths.filter((path) => path.contentPillarId === pillar.id);
  // Every stored path of this pillar (the lock and any format) carries the new development.
  const rewritten = previous.map((path) => ({
    ...path,
    reason,
    reviews: [...path.reviews.filter((item) => item.contentPillarId !== pillar.id), review],
  }));
  let next = paths.filter((path) => path.contentPillarId !== pillar.id).concat(rewritten);
  if (!rewritten.some((path) => path.format === null)) {
    next = upsertDevelopmentPath(next, {
      contentPillarId: pillar.id,
      pillarName: pillar.name,
      format: null,
      status: "RECOMMENDED",
      reason,
      reviews: [review],
      savedAt: new Date().toISOString(),
    });
  }
  await savePaths(admin, ctx, input.ideaId, next);
  return { saved: true, id: input.ideaId, pillars: cards(next) };
}

/** Remove one chosen content pillar from a locked Idea. Executions already written for it stay. */
export async function removeThinkingPillar(
  admin: SupabaseClient,
  ctx: Session,
  input: { ideaId: string; contentPillarId: string },
): Promise<ThinkingWriteResult & { pillars?: PillarCard[] }> {
  const chain = await loadChain(admin, ctx, input.ideaId);
  const paths = readDevelopmentPaths(chain.development_paths);
  if (!paths.some((path) => path.contentPillarId === input.contentPillarId)) {
    return { saved: false, failed: [{ check: "pillar", reason: "This content pillar is not chosen for this Idea." }] };
  }
  const next = paths.filter((path) => path.contentPillarId !== input.contentPillarId);
  await savePaths(admin, ctx, input.ideaId, next);
  return { saved: true, id: input.ideaId, pillars: cards(next) };
}
