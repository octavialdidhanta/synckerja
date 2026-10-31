import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { AuthzError } from "../authz/errors";
import type { McpAuthContext } from "../authz/context";
import type { ContentPlanRow } from "../db/listContentPlans";
import type { AccessClaims } from "../oauth/tokens";
import { contentPlansInput, contentPlansResult, whoamiInput, whoamiResult } from "../tools";
import { filterTools, isToolVisible } from "./filterTools";
import { PHASE0_TOOLS } from "./registry";

type HandlerDeps = {
  loadContext: (claims: AccessClaims) => Promise<McpAuthContext>;
  listContentPlans: (ctx: McpAuthContext) => Promise<ContentPlanRow[]>;
};

function forbidden() {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: "forbidden" }],
  };
}

async function reload(deps: HandlerDeps, claims: AccessClaims): Promise<McpAuthContext | null> {
  try {
    return await deps.loadContext(claims);
  } catch (error) {
    if (error instanceof AuthzError) return null;
    throw error;
  }
}

export async function handleMcpRequest(
  request: Request,
  claims: AccessClaims,
  deps: HandlerDeps,
): Promise<Response> {
  let ctx: McpAuthContext;
  try {
    ctx = await deps.loadContext(claims);
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const visible = new Set(filterTools(ctx).map((tool) => tool.name));
  const server = new McpServer({ name: "synckerja", version: "0.1.0" });
  const whoami = PHASE0_TOOLS.find((tool) => tool.name === "session.whoami");
  const plans = PHASE0_TOOLS.find((tool) => tool.name === "content.plans.list");

  if (visible.has("session.whoami") && whoami) {
    server.registerTool(
      "session.whoami",
      { description: whoami.description, inputSchema: whoamiInput },
      async () => {
        const fresh = await reload(deps, claims);
        if (!fresh || !isToolVisible("session.whoami", fresh)) return forbidden();
        return { content: [{ type: "text", text: JSON.stringify(whoamiResult(fresh)) }] };
      },
    );
  }

  if (visible.has("content.plans.list") && plans) {
    server.registerTool(
      "content.plans.list",
      { description: plans.description, inputSchema: contentPlansInput },
      async () => {
        const fresh = await reload(deps, claims);
        if (!fresh || !isToolVisible("content.plans.list", fresh)) return forbidden();
        const rows = await contentPlansResult(fresh, deps.listContentPlans);
        return { content: [{ type: "text", text: JSON.stringify(rows) }] };
      },
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
  }
}
