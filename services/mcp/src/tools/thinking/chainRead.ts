import type { McpAuthContext } from "../../authz/context";
import type { ThinkingChain } from "../../db/thinkingLab";
import { chainReadInput } from "./scriptInput";

export { chainReadInput };

export function chainReadResult(
  ctx: McpAuthContext,
  ideaId: string,
  read: (ctx: McpAuthContext, ideaId: string) => Promise<ThinkingChain>,
): Promise<ThinkingChain> {
  const parsed = chainReadInput.safeParse({ idea_id: ideaId });
  if (!parsed.success) throw new Error("invalid_input");
  return read(ctx, parsed.data.idea_id);
}
