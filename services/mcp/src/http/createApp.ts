import { Hono } from "hono";
import { cors } from "hono/cors";
import type { McpServiceConfig } from "../config";
import type { McpAuthContext } from "../authz/context";
import { AuthzError } from "../authz/errors";
import type { ContentPlanRow } from "../db/listContentPlans";
import type { CrmLeadRow, OkrCycleRow, OkrObjectiveRow } from "../db/phase1Reads";
import type {
  AdsAccountRow,
  EmployeeRow,
  ExpenseRow,
  IncomeRow,
  KolCampaignRow,
  KolProfileRow,
  StockRow,
  VisitRow,
} from "../db/phase2Reads";
import { handleMcpRequest } from "../mcp/handler";
import { beginAuthorization } from "../oauth/authorize";
import { registerClient } from "../oauth/clients";
import { completeConsent } from "../oauth/consent";
import { authorizationServerMetadata, protectedResourceMetadata } from "../oauth/discovery";
import { OAuthError } from "../oauth/errors";
import type { GrantStore } from "../oauth/store";
import { exchangeToken } from "../oauth/token";
import { verifyAccessToken, type AccessClaims } from "../oauth/tokens";

export type AppDeps = {
  config: McpServiceConfig;
  store: GrantStore;
  verifySupabaseUser: (jwt: string) => Promise<{ id: string } | null>;
  isActiveMember: (userId: string, organizationId: string) => Promise<boolean>;
  loadIdentity: (
    userId: string,
    organizationId: string,
  ) => Promise<{ profileId: string; employeeId: string | null } | null>;
  loadContext: (claims: AccessClaims) => Promise<McpAuthContext>;
  listContentPlans: (ctx: McpAuthContext) => Promise<ContentPlanRow[]>;
  listContentCalendar: (ctx: McpAuthContext, month: string | null) => Promise<ContentPlanRow[]>;
  listOkrCycles: (ctx: McpAuthContext) => Promise<OkrCycleRow[]>;
  listOkrObjectives: (ctx: McpAuthContext, cycleId: string | null) => Promise<OkrObjectiveRow[]>;
  listCrmLeads: (ctx: McpAuthContext, status: string | null) => Promise<CrmLeadRow[]>;
  listAdsAccounts: (ctx: McpAuthContext) => Promise<AdsAccountRow[]>;
  listIncomeTransactions: (ctx: McpAuthContext, month: string | null) => Promise<IncomeRow[]>;
  listExpenses: (ctx: McpAuthContext, month: string | null) => Promise<ExpenseRow[]>;
  listEmployees: (ctx: McpAuthContext) => Promise<EmployeeRow[]>;
  listCustomerVisits: (ctx: McpAuthContext, month: string | null) => Promise<VisitRow[]>;
  listKolCampaigns: (ctx: McpAuthContext) => Promise<KolCampaignRow[]>;
  listKolProfiles: (ctx: McpAuthContext) => Promise<KolProfileRow[]>;
  listInventoryStock: (ctx: McpAuthContext) => Promise<StockRow[]>;
  createContentPlan: (
    ctx: McpAuthContext,
    input: { title: string; postDate: string | null; brief: string | null },
  ) => Promise<ContentPlanRow>;
  updateContentPlan: (
    ctx: McpAuthContext,
    input: { id: string; title: string | null; postDate: string | null; brief: string | null },
  ) => Promise<ContentPlanRow>;
  createCompanyObjective: (
    ctx: McpAuthContext,
    input: { cycleId: string; title: string; whyImportant: string | null; status: string | null },
  ) => Promise<OkrObjectiveRow>;
  updateObjective: (
    ctx: McpAuthContext,
    input: { id: string; level: "company" | "department" | "individual"; title: string | null; status: string | null },
  ) => Promise<OkrObjectiveRow>;
  createLead: (
    ctx: McpAuthContext,
    input: {
      client: string;
      title: string;
      category: string;
      source: string | null;
      fuPriority: string | null;
      status: string | null;
    },
  ) => Promise<CrmLeadRow>;
  updateLead: (
    ctx: McpAuthContext,
    input: {
      id: string;
      client: string | null;
      title: string | null;
      category: string | null;
      source: string | null;
      fuPriority: string | null;
    },
  ) => Promise<CrmLeadRow>;
  now?: () => Date;
};

function oauthError(error: OAuthError) {
  return Response.json(
    { error: error.code, error_description: error.message },
    { status: error.status },
  );
}

async function readParams(c: { req: { header: (name: string) => string | undefined; json: () => Promise<unknown>; parseBody: () => Promise<Record<string, unknown>> } }): Promise<Record<string, string>> {
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === "string") params[key] = value;
    }
    return params;
  }
  const body = await c.req.parseBody();
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}

function allowedOrigins(config: McpServiceConfig): string[] {
  const origins = [config.officeOrigin];
  try {
    const url = new URL(config.publicUrl);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (local) {
      origins.push("http://localhost:6274", "http://127.0.0.1:6274");
    }
  } catch {
    /* publicUrl is validated before the server listens */
  }
  return origins;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const now = () => deps.now?.() ?? new Date();

  app.use(
    "*",
    cors({
      origin: allowedOrigins(deps.config),
      allowHeaders: ["Authorization", "Content-Type", "Accept", "Mcp-Protocol-Version", "Mcp-Session-Id"],
      exposeHeaders: ["WWW-Authenticate"],
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    }),
  );

  app.get("/.well-known/oauth-protected-resource", (c) => c.json(protectedResourceMetadata(deps.config)));
  app.get("/.well-known/oauth-protected-resource/mcp", (c) => c.json(protectedResourceMetadata(deps.config)));
  app.get("/.well-known/oauth-authorization-server", (c) => c.json(authorizationServerMetadata(deps.config)));

  app.post("/register", async (c) => {
    try {
      const body = await c.req.json();
      const client = await registerClient(deps.store, body);
      return c.json(client, 201);
    } catch (error) {
      if (error instanceof OAuthError) return oauthError(error);
      throw error;
    }
  });

  app.get("/authorize", async (c) => {
    try {
      const location = await beginAuthorization(deps.config, deps.store, new URL(c.req.url).searchParams, now());
      return c.redirect(location, 302);
    } catch (error) {
      if (error instanceof OAuthError) return oauthError(error);
      throw error;
    }
  });

  app.post("/oauth/consent", async (c) => {
    const header = c.req.header("authorization") || "";
    const jwt = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!jwt) return c.json({ error: "unauthorized" }, 401);
    const user = await deps.verifySupabaseUser(jwt);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const body = (await c.req.json().catch(() => null)) as { request_id?: unknown; organization_id?: unknown } | null;
    if (!body || typeof body.request_id !== "string" || typeof body.organization_id !== "string") {
      return c.json({ error: "invalid_request" }, 400);
    }
    try {
      const result = await completeConsent(
        { requestId: body.request_id, userId: user.id, organizationId: body.organization_id },
        {
          store: deps.store,
          isActiveMember: deps.isActiveMember,
          loadIdentity: deps.loadIdentity,
          now,
        },
      );
      return c.json(result);
    } catch (error) {
      if (error instanceof OAuthError) return oauthError(error);
      throw error;
    }
  });

  app.post("/token", async (c) => {
    try {
      const params = await readParams(c);
      const tokens = await exchangeToken(deps.config, deps.store, params, now());
      return c.json({
        access_token: tokens.accessToken,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: tokens.scope,
      });
    } catch (error) {
      if (error instanceof OAuthError) return oauthError(error);
      throw error;
    }
  });

  app.all("/mcp", async (c) => {
    const header = c.req.header("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    const claims = token ? await verifyAccessToken(deps.config, token) : null;
    if (!claims) {
      const metadataUrl = `${deps.config.publicUrl}/.well-known/oauth-protected-resource`;
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer realm="synckerja", resource_metadata="${metadataUrl}"`,
        },
      });
    }
    try {
      return await handleMcpRequest(c.req.raw, claims, deps);
    } catch (error) {
      if (error instanceof AuthzError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  });

  return app;
}
