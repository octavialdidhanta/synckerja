import type { McpAuthContext } from "../authz/context";
import { MCP_TOOLS, type McpTool } from "./registry";

export function filterTools(ctx: McpAuthContext, tools: McpTool[] = MCP_TOOLS): McpTool[] {
  return tools.filter((tool) => {
    if (!tool.scopes.every((scope) => ctx.scopes.includes(scope))) return false;
    if (tool.moduleKey && !ctx.modules[tool.moduleKey]) return false;
    if (tool.pagePaths && tool.pagePaths.length > 0) {
      if (!tool.pagePaths.some((path) => ctx.pages[path] === true)) return false;
    } else if (tool.pagePath && ctx.pages[tool.pagePath] !== true) return false;
    return true;
  });
}

export function isToolVisible(name: string, ctx: McpAuthContext): boolean {
  return filterTools(ctx).some((tool) => tool.name === name);
}
