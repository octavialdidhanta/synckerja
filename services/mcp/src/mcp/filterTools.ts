import type { McpAuthContext } from "../authz/context";
import { PHASE0_TOOLS, type Phase0Tool } from "./registry";

export function filterTools(ctx: McpAuthContext, tools: Phase0Tool[] = PHASE0_TOOLS): Phase0Tool[] {
  return tools.filter((tool) => {
    if (!tool.scopes.every((scope) => ctx.scopes.includes(scope))) return false;
    if (tool.moduleKey === "digitalMarketing" && !ctx.digitalMarketingEnabled) return false;
    if (tool.requiresContentPage && !ctx.contentPageAllowed) return false;
    return true;
  });
}

export function isToolVisible(name: string, ctx: McpAuthContext): boolean {
  return filterTools(ctx).some((tool) => tool.name === name);
}
