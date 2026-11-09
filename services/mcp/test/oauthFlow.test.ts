import { describe, expect, it } from "vitest";
import type { McpServiceConfig } from "../src/config";
import {
  CALENDAR_PAGE_PATH,
  CONTENT_PAGE_PATH,
  LEADS_PAGE_PATH,
  OKR_PAGE_PATH,
  type McpAuthContext,
} from "../src/authz/context";
import { createApp } from "../src/http/createApp";
import { connectorSessionKey, MemoryGrantStore } from "../src/oauth/memoryStore";
import { pkceS256, sha256Hex } from "../src/oauth/pkce";
import { verifyAccessToken, type AccessClaims } from "../src/oauth/tokens";

const config: McpServiceConfig = {
  publicUrl: "http://localhost:8787",
  officeOrigin: "http://localhost:8080",
  jwtSecret: "test-secret-at-least-16",
  port: 8787,
  supabaseUrl: "http://localhost:54321",
  supabaseServiceRoleKey: "service-role-test",
  scheduledPostsInternalSecret: "schedule-secret",
};

const USER = "user-1";
const ORG = "org-1";
const PROFILE = "profile-1";
const REDIRECT = "http://127.0.0.1:6274/oauth/callback";

function contextFor(claims: AccessClaims, organizationId = claims.orgId ?? ORG): McpAuthContext {
  return {
    userId: claims.sub,
    profileId: claims.profileId,
    organizationId,
    employeeId: claims.employeeId,
    companyName: "Acme",
    roles: ["employee"],
    scopes: claims.scopes,
    clientId: claims.clientId,
    membershipActive: true,
    organizations: [{ id: organizationId, name: "Acme", roles: ["employee"] }],
    modules: {
      digitalMarketing: true,
      okr: true,
      omnichannel: true,
      finance: true,
      humanResources: true,
      operations: true,
      tools: true,
    },
    pages: {
      [CONTENT_PAGE_PATH]: true,
      [CALENDAR_PAGE_PATH]: true,
      [OKR_PAGE_PATH]: true,
      [LEADS_PAGE_PATH]: true,
    },
  };
}

function appFor(store: MemoryGrantStore, members = new Set([`${USER}:${ORG}`])) {
  const listed: string[] = [];
  const app = createApp({
    config,
    store,
    now: () => new Date("2026-10-31T00:00:00.000Z"),
    verifySupabaseUser: async (jwt) => (jwt === "supabase-user" ? { id: USER } : null),
    isActiveMember: async (userId, organizationId) => members.has(`${userId}:${organizationId}`),
    loadIdentity: async (userId, organizationId) => {
      if (!members.has(`${userId}:${organizationId}`)) return null;
      return { profileId: PROFILE, employeeId: "emp-1" };
    },
    loadContext: async (claims) => {
      const session = await store.findConnectorSession(claims.sub, claims.clientId);
      const organizationId = session?.activeOrganizationId ?? claims.orgId;
      if (!organizationId || !members.has(`${claims.sub}:${organizationId}`)) {
        const { AuthzError } = await import("../src/authz/errors");
        throw new AuthzError("not_a_member", 401);
      }
      return contextFor(claims, organizationId);
    },
    accessRevokedAt: async () => null,
    switchOrganization: async () => {
      throw new Error("unused");
    },
    takeToolSlot: async () => ({ allowed: true, recordDenial: false }),
    recordToolCall: async () => {},
    listContentPlans: async (ctx) => {
      listed.push(ctx.organizationId);
      return [
        {
          id: "plan-1",
          title: "Launch",
          status: "draft",
          post_date: null,
          approved: false,
          production_status: null,
        },
      ];
    },
    listContentCalendar: async () => [],
    listContentCatalog: async () => [],
    listOkrCycles: async () => [],
    listOkrObjectives: async () => [],
    listOkrDepartments: async () => [],
    listCrmLeads: async () => [],
    listInboxConversations: async () => [],
    listInboxMessages: async () => [],
    readInboxSummary: async () => [],
    readSocialComments: async () => { throw new Error("unused"); },
    listAdsAccounts: async () => [],
    listAdsPerformance: async () => {
      throw new Error("unused");
    },
    listAdsBreakdown: async () => {
      throw new Error("unused");
    },
    listAdsAudience: async () => {
      throw new Error("unused");
    },
    listAdsSegments: async () => {
      throw new Error("unused");
    },
    listIncomeTransactions: async () => [],
    listExpenses: async () => [],
    listEmployees: async () => [],
    listPayrollRuns: async () => [],
    listCustomerVisits: async () => [],
    listPosDailySales: async () => [],
    listKolCampaigns: async () => [],
    listKolProfiles: async () => [],
    listInventoryStock: async () => [],
    listInventorySummary: async () => {
      throw new Error("unused");
    },
    createInventoryPurchaseOrder: async () => {
      throw new Error("unused");
    },
    listCatalogSuppliers: async () => [],
    listRecipeCosts: async () => ({}),
    createRecipeDraft: async () => ({}),
    listRecipeDrafts: async () => ({}),
    previewInventoryPurchaseOrder: async () => {
      throw new Error("unused");
    },
    writeInventoryIngredient: async () => {
      throw new Error("unused");
    },
    listOpenPurchaseOrders: async () => {
      throw new Error("unused");
    },
    previewReceivePurchaseOrder: async () => {
      throw new Error("unused");
    },
    receivePurchaseOrder: async () => {
      throw new Error("unused");
    },
    previewStockAdjustment: async () => {
      throw new Error("unused");
    },
    createStockAdjustment: async () => {
      throw new Error("unused");
    },
    previewIngredientProduction: async () => {
      throw new Error("unused");
    },
    createIngredientProduction: async () => {
      throw new Error("unused");
    },
    createContentPlan: async () => {
      throw new Error("unused");
    },
    createContentBrief: async () => {
      throw new Error("unused");
    },
    listLeadMagnetDrafts: async () => [],
    attachLeadMagnetDelivery: async () => {
      throw new Error("unused");
    },
    listThinkingIdeas: async () => [],
    readThinkingChain: async () => {
      throw new Error("unused");
    },
    checkThinkingExecution: async () => {
      throw new Error("unused");
    },
    saveThinkingPlan: async () => {
      throw new Error("unused");
    },
    saveThinkingPlanDirect: async () => {
      throw new Error("unused");
    },
    updateContentPlan: async () => {
      throw new Error("unused");
    },
    createCompanyObjective: async () => {
      throw new Error("unused");
    },
    updateObjective: async () => {
      throw new Error("unused");
    },
    createDepartmentObjective: async () => {
      throw new Error("unused");
    },
    createIndividualObjective: async () => {
      throw new Error("unused");
    },
    createLead: async () => {
      throw new Error("unused");
    },
    updateLead: async () => {
      throw new Error("unused");
    },
    scheduleContentPlan: async () => {
      throw new Error("unused");
    },
    setLeadStatus: async () => {
      throw new Error("unused");
    },
    createIncomeTransaction: async () => {
      throw new Error("unused");
    },
    updateIncomeTransaction: async () => {
      throw new Error("unused");
    },
    createExpenseRecord: async () => {
      throw new Error("unused");
    },
    updateExpenseRecord: async () => {
      throw new Error("unused");
    },
    listTaskSummary: async () => {
      throw new Error("unused");
    },
    listTasks: async () => [],
    listTaskInitiative: async () => [],
    listTaskWorkload: async () => [],
    listCompletedSteps: async () => [],
    createTask: async () => {
      throw new Error("unused");
    },
    updateTask: async () => {
      throw new Error("unused");
    },
    deleteTask: async () => {
      throw new Error("unused");
    },
    assignTask: async () => {
      throw new Error("unused");
    },
    linkTaskObjective: async () => {
      throw new Error("unused");
    },
    takeTaskInitiative: async () => {
      throw new Error("unused");
    },
    listTaskSteps: async () => [],
    createTaskStep: async () => {
      throw new Error("unused");
    },
    updateTaskStep: async () => {
      throw new Error("unused");
    },
    deleteTaskStep: async () => {
      throw new Error("unused");
    },
    listTaskSubsteps: async () => [],
    createTaskSubstep: async () => {
      throw new Error("unused");
    },
    attachTaskStepImage: async () => {
      throw new Error("unused");
    },
    listHabits: async () => [],
    checkHabit: async () => {
      throw new Error("unused");
    },
    listAiEmployees: async () => [],
    aiEmployeeStatus: async () => {
      throw new Error("unused");
    },
    aiEmployeeRuns: async () => {
      throw new Error("unused");
    },
    aiEmployeeReport: async () => {
      throw new Error("unused");
    },
    aiEmployeeQueueList: async () => {
      throw new Error("unused");
    },
    aiEmployeeCommand: async () => {
      throw new Error("unused");
    },
    aiEmployeeChat: async () => {
      throw new Error("unused");
    },
    aiEmployeeScheduleUpdate: async () => {
      throw new Error("unused");
    },
    aiEmployeeRoutinesList: async () => {
      throw new Error("unused");
    },
    aiEmployeeRoutineUpsert: async () => {
      throw new Error("unused");
    },
    aiEmployeeBriefGet: async () => {
      throw new Error("unused");
    },
    aiEmployeeBriefUpdate: async () => {
      throw new Error("unused");
    },
    listProductKnowledge: async () => {
      throw new Error("unused");
    },
  });
  return { app, listed };
}

async function register(app: ReturnType<typeof createApp>) {
  const response = await app.request("http://localhost:8787/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Inspector",
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: "none",
    }),
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { client_id: string };
  return body.client_id;
}

function authorizeUrl(clientId: string, verifier: string, scope = "session:read content:read") {
  const url = new URL("http://localhost:8787/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", pkceS256(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", "state-1");
  url.searchParams.set("resource", "http://localhost:8787/mcp");
  return url;
}

async function consent(app: ReturnType<typeof createApp>, requestId: string, organizationId = ORG) {
  return app.request("http://localhost:8787/oauth/consent", {
    method: "POST",
    headers: {
      authorization: "Bearer supabase-user",
      "content-type": "application/json",
    },
    body: JSON.stringify({ request_id: requestId, organization_id: organizationId }),
  });
}

describe("oauth and mcp http flow", () => {
  it("issues an org-locked token and lists both read tools", async () => {
    const store = new MemoryGrantStore();
    const { app, listed } = appFor(store);
    const clientId = await register(app);
    const verifier = "verifier-value-which-is-long-enough";
    const authorize = await app.request(authorizeUrl(clientId, verifier));
    expect(authorize.status).toBe(302);
    const location = new URL(authorize.headers.get("location") || "");
    expect(location.origin).toBe("http://localhost:8080");
    expect(location.pathname).toBe("/oauth/consent");
    const requestId = location.searchParams.get("request") || "";

    const consented = await consent(app, requestId);
    expect(consented.status).toBe(200);
    const redirect = new URL(((await consented.json()) as { redirect_url: string }).redirect_url);
    expect(redirect.searchParams.get("state")).toBe("state-1");
    const code = redirect.searchParams.get("code") || "";

    const tokenResponse = await app.request("http://localhost:8787/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT,
        client_id: clientId,
        code_verifier: verifier,
      }),
    });
    expect(tokenResponse.status).toBe(200);
    const token = (await tokenResponse.json()) as { access_token: string; scope: string };
    expect(token.scope).toBe("session:read content:read");

    const reused = await app.request("http://localhost:8787/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT,
        client_id: clientId,
        code_verifier: verifier,
      }),
    });
    expect(reused.status).toBe(400);

    const init = await app.request("http://localhost:8787/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token.access_token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "0" },
        },
      }),
    });
    expect(init.status).toBe(200);
    const initBody = (await init.json()) as { result?: { instructions?: string } };
    expect(initBody.result?.instructions ?? "").toContain("ai_employee.chat");
    expect(initBody.result?.instructions ?? "").toContain("outside_job_desk");
    expect(initBody.result?.instructions ?? "").toContain("Naya:");

    const tools = await app.request("http://localhost:8787/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token.access_token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect(tools.status).toBe(200);
    const toolsBody = (await tools.json()) as { result: { tools: { name: string }[] } };
    const names = toolsBody.result.tools.map((tool) => tool.name);
    expect(names).toEqual([
      "session.whoami",
      "session.orgs.list",
      "session.switchOrg",
      "content.plans.list",
      "content.calendar.list",
      "content.catalog.list",
      "product_knowledge.list",
      "ai_employee.list",
      "ai_employee.status",
      "ai_employee.runs.list",
      "ai_employee.report",
      "ai_employee.queue.list",
      "ai_employee.command",
      "ai_employee.chat",
      "ai_employee.routines.list",
      "ai_employee.routine.upsert",
      "ai_employee.schedule.update",
      "ai_employee.brief.get",
      "ai_employee.brief.update",
    ]);

    const who = await app.request("http://localhost:8787/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token.access_token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "session.whoami", arguments: {} },
      }),
    });
    expect(who.status).toBe(200);
    const whoBody = (await who.json()) as { result: { content: { text: string }[] } };
    expect(JSON.parse(whoBody.result.content[0].text).organization_id).toBe(ORG);

    const plans = await app.request("http://localhost:8787/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token.access_token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "content.plans.list", arguments: {} },
      }),
    });
    expect(plans.status).toBe(200);
    expect(listed).toEqual([ORG]);
    expect(store.codes.size).toBe(1);
    expect([...store.codes.values()][0]?.consumedAt).toBeTruthy();
  });

  it("keeps a switched organization when the refresh token is rotated", async () => {
    const store = new MemoryGrantStore();
    const { app } = appFor(store);
    const clientId = await register(app);
    const verifier = "verifier-for-refresh-keeps-org";
    const authorize = await app.request(authorizeUrl(clientId, verifier));
    const requestId = new URL(authorize.headers.get("location") || "").searchParams.get("request") || "";
    const consented = await consent(app, requestId);
    const code = new URL(((await consented.json()) as { redirect_url: string }).redirect_url).searchParams.get("code") || "";
    const tokenResponse = await app.request("http://localhost:8787/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT,
        client_id: clientId,
        code_verifier: verifier,
      }),
    });
    const issued = (await tokenResponse.json()) as { access_token: string; refresh_token: string };
    const firstClaims = await verifyAccessToken(config, issued.access_token);
    expect(firstClaims?.orgId).toBeNull();
    expect(firstClaims?.connectionId).toBeTruthy();

    const session = store.sessions.get(connectorSessionKey(USER, clientId));
    expect(session?.activeOrganizationId).toBe(ORG);
    if (!session) throw new Error("missing session");
    session.activeOrganizationId = "org-2";

    const refreshed = await app.request("http://localhost:8787/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: issued.refresh_token,
        client_id: clientId,
      }),
    });
    expect(refreshed.status).toBe(200);
    const next = (await refreshed.json()) as { access_token: string };
    const nextClaims = await verifyAccessToken(config, next.access_token);
    expect(nextClaims?.orgId).toBeNull();
    expect(nextClaims?.connectionId).toBe(firstClaims?.connectionId);
    const live = [...store.refreshTokens.values()].find((row) => !row.revokedAt);
    expect(live?.organizationId).toBe("org-2");
    expect(store.sessions.get(connectorSessionKey(USER, clientId))?.activeOrganizationId).toBe("org-2");
  });

  it("rejects a bad PKCE verifier and does not accept that code afterwards", async () => {
    const store = new MemoryGrantStore();
    const { app } = appFor(store);
    const clientId = await register(app);
    const verifier = "correct-verifier-value-long";
    const authorize = await app.request(authorizeUrl(clientId, verifier));
    const requestId = new URL(authorize.headers.get("location") || "").searchParams.get("request") || "";
    const consented = await consent(app, requestId);
    const code = new URL(((await consented.json()) as { redirect_url: string }).redirect_url).searchParams.get("code") || "";

    const bad = await app.request("http://localhost:8787/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT,
        client_id: clientId,
        code_verifier: "wrong-verifier-value-long",
      }),
    });
    expect(bad.status).toBe(400);

    const again = await app.request("http://localhost:8787/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT,
        client_id: clientId,
        code_verifier: verifier,
      }),
    });
    expect(again.status).toBe(400);
    expect(sha256Hex(code)).toBe([...store.codes.keys()][0]);
  });

  it("refuses consent for an organization the user does not belong to", async () => {
    const store = new MemoryGrantStore();
    const { app } = appFor(store);
    const clientId = await register(app);
    const verifier = "verifier-for-foreign-org-flow";
    const authorize = await app.request(authorizeUrl(clientId, verifier));
    const requestId = new URL(authorize.headers.get("location") || "").searchParams.get("request") || "";
    const response = await consent(app, requestId, "org-other");
    expect(response.status).toBe(403);
    expect(store.codes.size).toBe(0);
  });
});
