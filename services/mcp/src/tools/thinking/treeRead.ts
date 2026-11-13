import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ThinkingMasterRow, ThinkingTree } from "../../db/thinkingLab";

export const mastersListInput = z.object({}).strict();

export const treeReadInput = z.object({
  master_thought_id: z.string().uuid(),
}).strict();

export function mastersListResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<ThinkingMasterRow[]>,
): Promise<ThinkingMasterRow[]> {
  return list(ctx);
}

export function treeReadResult(
  ctx: McpAuthContext,
  masterThoughtId: string,
  read: (ctx: McpAuthContext, masterThoughtId: string) => Promise<ThinkingTree>,
): Promise<ThinkingTree> {
  const parsed = treeReadInput.safeParse({ master_thought_id: masterThoughtId });
  if (!parsed.success) throw new Error("invalid_input");
  return read(ctx, parsed.data.master_thought_id);
}
