import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { ZodRawShape, ZodTypeAny } from "zod";
import { AuthzError } from "../authz/errors";
import type { McpAuthContext } from "../authz/context";
import type { ContentPlanRow } from "../db/listContentPlans";
import type { CrmLeadRow, OkrCycleRow, OkrObjectiveRow } from "../db/phase1Reads";
import type { AccessClaims } from "../oauth/tokens";
import {
  calendarInput,
  calendarResult,
  contentPlansInput,
  contentPlansResult,
  cyclesInput,
  cyclesResult,
  leadsInput,
  leadsResult,
  objectivesInput,
  objectivesResult,
  whoamiInput,
  whoamiResult,
} from "../tools";
import { filterTools, isToolVisible } from "./filterTools";
import type { McpToolName } from "./registry";

export type McpReadDeps = {
  listContentPlans: (ctx: McpAuthContext) => Promise<ContentPlanRow[]>;
  listContentCalendar: (ctx: McpAuthContext, month: string | null) => Promise<ContentPlanRow[]>;
  listOkrCycles: (ctx: McpAuthContext) => Promise<OkrCycleRow[]>;
  listOkrObjectives: (ctx: McpAuthContext, cycleId: string | null) => Promise<OkrObjectiveRow[]>;
  listCrmLeads: (ctx: McpAuthContext, status: string | null) => Promise<CrmLeadRow[]>;
};

type HandlerDeps = McpReadDeps & {
  loadContext: (claims: AccessClaims) => Promise<McpAuthContext>;
};

type ToolArgs = Record<string, unknown>;

function forbidden() {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: "forbidden" }],
  };
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function reload(deps: HandlerDeps, claims: AccessClaims): Promise<McpAuthContext | null> {
  try {
    return await deps.loadContext(claims);
  } catch (error) {
    if (error instanceof AuthzError) return null;
    throw error;
  }
}

const toolInputs: Record<McpToolName, ZodTypeAny> = {
  "session.whoami": whoamiInput,
  "content.plans.list": contentPlansInput,
  "content.calendar.list": calendarInput,
  "okr.cycles.list": cyclesInput,
  "okr.objectives.list": objectivesInput,
  "crm.leads.list": leadsInput,
};

async function runTool(name: McpToolName, ctx: McpAuthContext, args: ToolArgs, deps: McpReadDeps): Promise<unknown> {
  switch (name) {
    case "session.whoami":
      return whoamiResult(ctx);
    case "content.plans.list":
      return contentPlansResult(ctx, deps.listContentPlans);
    case "content.calendar.list":
      return calendarResult(ctx, optionalString(args.month), deps.listContentCalendar);
    case "okr.cycles.list":
      return cyclesResult(ctx, deps.listOkrCycles);
    case "okr.objectives.list":
      return objectivesResult(ctx, optionalString(args.cycle_id), deps.listOkrObjectives);
    case "crm.leads.list":
      return leadsResult(ctx, optionalString(args.status), deps.listCrmLeads);
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

  const server = new McpServer({ name: "synckerja", version: "0.1.0" });
  for (const tool of filterTools(ctx)) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: toolInputs[tool.name] as unknown as ZodRawShape },
      async (args) => {
        const fresh = await reload(deps, claims);
        if (!fresh || !isToolVisible(tool.name, fresh)) return forbidden();
        const body = await runTool(tool.name, fresh, (args ?? {}) as ToolArgs, deps);
        return { content: [{ type: "text", text: JSON.stringify(body) }] };
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
