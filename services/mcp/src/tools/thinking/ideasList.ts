import type { McpAuthContext } from "../../authz/context";
import type { ThinkingIdeaRow } from "../../db/thinkingLab";
import { ideasListInput } from "./scriptInput";

export { ideasListInput };

export function ideasListResult(
  ctx: McpAuthContext,
  list: (ctx: McpAuthContext) => Promise<ThinkingIdeaRow[]>,
): Promise<ThinkingIdeaRow[]> {
  return list(ctx);
}
