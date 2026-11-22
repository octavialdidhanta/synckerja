import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { FootageBansResult } from "../../db/footage";

export const listFootageBansInput = z.object({}).strict();

export function listFootageBansResult(
  ctx: McpAuthContext,
  args: unknown,
  list: (ctx: McpAuthContext) => Promise<FootageBansResult>,
): Promise<FootageBansResult> {
  if (!listFootageBansInput.safeParse(args ?? {}).success) throw new Error("invalid_input");
  return list(ctx);
}
