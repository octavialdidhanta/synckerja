import { Hono } from "hono";
import { cors } from "hono/cors";
import type { McpServiceConfig } from "../config";
import type { McpAuthContext } from "../authz/context";
import { AuthzError } from "../authz/errors";
import type { ContentPlanRow } from "../db/listContentPlans";
import type { ContentBriefRecord, ContentBriefWrite, ContentCatalogRow } from "../db/contentBriefs";
import type { LeadMagnetDeliveryResult, LeadMagnetDraft } from "../db/leadMagnet";
import type { ThinkingChain, ThinkingCheckResult, ThinkingIdeaRow, ThinkingPlanResult } from "../db/thinkingLab";
import type { ThinkingPlanDirectInput } from "../tools/thinking/planDirect";
import type { ThinkingPlanSaveInput } from "../tools/thinking/planSave";
import type { ThinkingScriptDraft } from "../tools/thinking/scriptInput";
import type { CrmLeadRow, OkrCycleRow, OkrDepartmentRow, OkrObjectiveListRow, OkrObjectiveRow } from "../db/phase1Reads";
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
import type { ExpenseRecord, IncomeRecord } from "../db/phase5Writes";
import type { DepartmentObjectiveRecord, IndividualObjectiveRecord } from "../db/phase3Writes";
import type { PayrollRunRow, PosDailySalesRow } from "../db/payrollPosReads";
import type {
  AssignTaskInput,
  AssignTaskResult,
  CompletedStepRow,
  CreateTaskInput,
  InitiativeRow,
  TakeInitiativeInput,
  TakeInitiativeResult,
  TaskListRow,
  TaskObjectiveLink,
  TaskRecord,
  TaskStepRecord,
  TaskStepRow,
  TaskSubstepRecord,
  TaskSubstepRow,
  TaskSummary,
  UpdateTaskInput,
  WorkloadRow,
} from "../db/dailyTasks";
import type { HabitCheckInput, HabitCheckResult, HabitDayRow } from "../db/habits";
import type { TaskStepImageRecord } from "../db/stepImages";
import { isAccessRevoked } from "../authz/toolGate";
import type { ToolCallOutcome } from "../db/toolGate";
import { handleMcpRequest } from "../mcp/handler";
import { beginAuthorization } from "../oauth/authorize";
import { registerClient } from "../oauth/clients";
import { completeConsent } from "../oauth/consent";
import { authorizationServerMetadata, protectedResourceMetadata } from "../oauth/discovery";
import { OAuthError } from "../oauth/errors";
import type { GrantStore } from "../oauth/store";
import { exchangeToken } from "../oauth/token";
import { verifyAccessToken, type AccessClaims } from "../oauth/tokens";
import type { SchedulePlanResult } from "../tools/content/plansSchedule";
import { signConfirmation, verifyConfirmation } from "../tools/inventory/confirmation";

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
  accessRevokedAt: (claims: AccessClaims) => Promise<string | null>;
  takeToolSlot: (ctx: McpAuthContext) => Promise<{ allowed: boolean; recordDenial: boolean }>;
  recordToolCall: (ctx: McpAuthContext, toolName: string, outcome: ToolCallOutcome) => Promise<void>;
  switchOrganization: (ctx: McpAuthContext, organizationId: string) => Promise<void>;
  listContentPlans: (ctx: McpAuthContext) => Promise<ContentPlanRow[]>;
  listContentCalendar: (ctx: McpAuthContext, month: string | null) => Promise<ContentPlanRow[]>;
  listContentCatalog: (ctx: McpAuthContext) => Promise<ContentCatalogRow[]>;
  listOkrCycles: (ctx: McpAuthContext) => Promise<OkrCycleRow[]>;
  listOkrObjectives: (ctx: McpAuthContext, cycleId: string | null) => Promise<OkrObjectiveListRow[]>;
  listOkrDepartments: (ctx: McpAuthContext) => Promise<OkrDepartmentRow[]>;
  listCrmLeads: (ctx: McpAuthContext, status: string | null) => Promise<CrmLeadRow[]>;
  listInboxConversations: (
    ctx: McpAuthContext,
    query: import("../tools/inbox/inboxQuery").InboxConversationsQuery,
  ) => Promise<import("../tools/inbox/inboxQuery").InboxConversationRow[]>;
  listInboxMessages: (
    ctx: McpAuthContext,
    query: import("../tools/inbox/inboxQuery").InboxMessagesQuery,
  ) => Promise<import("../tools/inbox/inboxQuery").InboxMessageRow[]>;
  readInboxSummary: (
    ctx: McpAuthContext,
    query: import("../tools/inbox/inboxQuery").InboxSummaryQuery,
  ) => Promise<import("../tools/inbox/inboxQuery").InboxSummaryRow[]>;
  readSocialComments: (
    ctx: McpAuthContext,
    query: import("../tools/comments/commentsQuery").CommentsQuery,
  ) => Promise<import("../tools/comments/commentsQuery").CommentsSource>;
  listAdsAccounts: (ctx: McpAuthContext) => Promise<AdsAccountRow[]>;
  listAdsPerformance: (
    ctx: McpAuthContext,
    query: import("../tools/ads/performanceSummary").AdsPerformanceQuery,
  ) => Promise<import("../tools/ads/performanceSummary").AdsPerformanceSummary>;
  listAdsBreakdown: (
    ctx: McpAuthContext,
    query: import("../tools/ads/performanceBreakdown").AdsBreakdownQuery,
  ) => Promise<import("../tools/ads/performanceBreakdown").AdsBreakdown>;
  listAdsAudience: (
    ctx: McpAuthContext,
    query: import("../tools/ads/audienceList").AdsAudienceQuery,
  ) => Promise<import("../tools/ads/audienceList").AdsAudience>;
  listAdsSegments: (
    ctx: McpAuthContext,
    query: import("../tools/ads/performanceSegments").AdsSegmentsQuery,
  ) => Promise<import("../tools/ads/performanceSegments").AdsSegments>;
  listIncomeTransactions: (ctx: McpAuthContext, month: string | null) => Promise<IncomeRow[]>;
  listExpenses: (ctx: McpAuthContext, month: string | null) => Promise<ExpenseRow[]>;
  listEmployees: (ctx: McpAuthContext) => Promise<EmployeeRow[]>;
  listPayrollRuns: (ctx: McpAuthContext, month: string | null) => Promise<PayrollRunRow[]>;
  listCustomerVisits: (ctx: McpAuthContext, month: string | null) => Promise<VisitRow[]>;
  listPosDailySales: (ctx: McpAuthContext, month: string | null) => Promise<PosDailySalesRow[]>;
  listKolCampaigns: (ctx: McpAuthContext) => Promise<KolCampaignRow[]>;
  listKolProfiles: (ctx: McpAuthContext) => Promise<KolProfileRow[]>;
  listInventoryStock: (ctx: McpAuthContext) => Promise<StockRow[]>;
  listInventorySummary: (
    ctx: McpAuthContext,
    query: import("../tools/inventory/summaryList").InventorySummaryQuery,
  ) => Promise<import("../db/inventorySummary").InventorySummary>;
  createRecipeDraft: (
    ctx: McpAuthContext,
    input: import("../tools/inventory/recipeDrafts").RecipeDraftCreate,
  ) => Promise<Record<string, unknown>>;
  listRecipeDrafts: (ctx: McpAuthContext, status: string | null) => Promise<Record<string, unknown>>;
  listRecipeCosts: (
    ctx: McpAuthContext,
    query: import("../tools/inventory/recipeCosts").RecipeCostsQuery,
  ) => Promise<Record<string, unknown>>;
  listCatalogSuppliers: (
    ctx: McpAuthContext,
    search: string | null,
  ) => Promise<import("../tools/inventory/supplierList").SupplierRow[]>;
  previewInventoryPurchaseOrder: (
    ctx: McpAuthContext,
    input: import("../tools/inventory/purchaseOrderCreate").InventoryPurchaseOrderInput,
  ) => Promise<import("../db/inventoryPurchaseOrder").InventoryPurchaseOrderPreview>;
  createInventoryPurchaseOrder: (
    ctx: McpAuthContext,
    input: import("../tools/inventory/purchaseOrderCreate").InventoryPurchaseOrderInput,
    confirmId: string,
  ) => Promise<import("../db/inventoryPurchaseOrder").InventoryPurchaseOrder>;
  writeInventoryIngredient: (
    ctx: McpAuthContext,
    input: import("../tools/inventory/ingredientCreate").IngredientWriteInput,
    confirmId: string | null,
  ) => Promise<import("../db/inventoryIngredient").IngredientWriteResult>;
  previewIngredientProduction: (
    ctx: McpAuthContext,
    input: import("../tools/inventory/productionCreate").ProductionPreviewInput,
  ) => Promise<Record<string, unknown>>;
  createIngredientProduction: (
    ctx: McpAuthContext,
    input: import("../tools/inventory/productionCreate").ProductionWriteInput,
    confirmId: string,
  ) => Promise<Record<string, unknown>>;
  createContentPlan: (
    ctx: McpAuthContext,
    input: { title: string; postDate: string | null; brief: string | null },
  ) => Promise<ContentPlanRow>;
  createContentBrief: (ctx: McpAuthContext, input: ContentBriefWrite) => Promise<ContentBriefRecord>;
  listLeadMagnetDrafts: (ctx: McpAuthContext, campaignId: string | null) => Promise<LeadMagnetDraft[]>;
  attachLeadMagnetDelivery: (
    ctx: McpAuthContext,
    input: { campaignId: string; fileUrl: string },
  ) => Promise<LeadMagnetDeliveryResult>;
  listThinkingIdeas: (ctx: McpAuthContext) => Promise<ThinkingIdeaRow[]>;
  readThinkingChain: (ctx: McpAuthContext, ideaId: string) => Promise<ThinkingChain>;
  checkThinkingExecution: (
    ctx: McpAuthContext,
    input: { ideaId: string; contentPillarId: string; script: ThinkingScriptDraft },
  ) => Promise<ThinkingCheckResult>;
  saveThinkingPlan: (ctx: McpAuthContext, input: ThinkingPlanSaveInput) => Promise<ThinkingPlanResult>;
  saveThinkingPlanDirect: (ctx: McpAuthContext, input: ThinkingPlanDirectInput) => Promise<ThinkingPlanResult>;
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
  createDepartmentObjective: (
    ctx: McpAuthContext,
    input: {
      companyObjectiveId: string;
      departmentId: string;
      title: string;
      description: string | null;
      status: string | null;
    },
  ) => Promise<DepartmentObjectiveRecord>;
  createIndividualObjective: (
    ctx: McpAuthContext,
    input: {
      departmentObjectiveId: string;
      title: string;
      description: string | null;
      status: string | null;
      employeeId: string | null;
    },
  ) => Promise<IndividualObjectiveRecord>;
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
  scheduleContentPlan: (ctx: McpAuthContext, id: string) => Promise<SchedulePlanResult>;
  setLeadStatus: (ctx: McpAuthContext, input: { id: string; status: string }) => Promise<CrmLeadRow>;
  createIncomeTransaction: (
    ctx: McpAuthContext,
    input: {
      transactionDate: string;
      amount: number;
      customerName: string | null;
      paymentMethod: string | null;
      description: string | null;
    },
  ) => Promise<IncomeRecord>;
  updateIncomeTransaction: (
    ctx: McpAuthContext,
    input: {
      id: string;
      transactionDate: string | null;
      amount: number | null;
      customerName: string | null;
      paymentMethod: string | null;
      description: string | null;
    },
  ) => Promise<IncomeRecord>;
  createExpenseRecord: (
    ctx: McpAuthContext,
    input: {
      expenseName: string;
      amount: number;
      createDate: string;
      expenseType: string;
      category: string;
      description: string | null;
    },
  ) => Promise<ExpenseRecord>;
  updateExpenseRecord: (
    ctx: McpAuthContext,
    input: {
      id: string;
      expenseName: string | null;
      amount: number | null;
      createDate: string | null;
      expenseType: string | null;
      category: string | null;
      description: string | null;
    },
  ) => Promise<ExpenseRecord>;
  listTaskSummary: (ctx: McpAuthContext, month: string | null) => Promise<TaskSummary>;
  listTasks: (ctx: McpAuthContext, status: string | null, month: string | null) => Promise<TaskListRow[]>;
  listTaskInitiative: (ctx: McpAuthContext) => Promise<InitiativeRow[]>;
  listTaskWorkload: (ctx: McpAuthContext, timeframe: string | null) => Promise<WorkloadRow[]>;
  listCompletedSteps: (ctx: McpAuthContext, month: string | null) => Promise<CompletedStepRow[]>;
  createTask: (ctx: McpAuthContext, input: CreateTaskInput) => Promise<TaskRecord>;
  updateTask: (ctx: McpAuthContext, input: UpdateTaskInput) => Promise<TaskRecord>;
  deleteTask: (ctx: McpAuthContext, id: string) => Promise<{ id: string }>;
  assignTask: (ctx: McpAuthContext, input: AssignTaskInput) => Promise<AssignTaskResult>;
  linkTaskObjective: (
    ctx: McpAuthContext,
    input: { taskId: string; individualObjectiveId: string },
  ) => Promise<TaskObjectiveLink>;
  takeTaskInitiative: (ctx: McpAuthContext, input: TakeInitiativeInput) => Promise<TakeInitiativeResult>;
  listTaskSteps: (ctx: McpAuthContext, taskId: string) => Promise<TaskStepRow[]>;
  createTaskStep: (
    ctx: McpAuthContext,
    input: { taskId: string; title: string; description: string | null },
  ) => Promise<TaskStepRecord>;
  updateTaskStep: (
    ctx: McpAuthContext,
    input: { id: string; title: string; description: string | null },
  ) => Promise<TaskStepRecord>;
  deleteTaskStep: (ctx: McpAuthContext, id: string) => Promise<{ id: string }>;
  listTaskSubsteps: (ctx: McpAuthContext, stepId: string) => Promise<TaskSubstepRow[]>;
  createTaskSubstep: (ctx: McpAuthContext, input: { stepId: string; title: string }) => Promise<TaskSubstepRecord>;
  attachTaskStepImage: (ctx: McpAuthContext, input: { stepId: string; imageUrl: string }) => Promise<TaskStepImageRecord>;
  listHabits: (ctx: McpAuthContext, date: string | null) => Promise<HabitDayRow[]>;
  checkHabit: (ctx: McpAuthContext, input: HabitCheckInput) => Promise<HabitCheckResult>;
  listAiEmployees: (ctx: McpAuthContext) => Promise<import("../db/aiEmployee").AiEmployeeListItem[]>;
  aiEmployeeStatus: (ctx: McpAuthContext, employeeName: string) => Promise<unknown>;
  aiEmployeeRuns: (ctx: McpAuthContext, employeeName: string, limit: number | null) => Promise<unknown>;
  aiEmployeeReport: (ctx: McpAuthContext, employeeName: string, period: string) => Promise<unknown>;
  aiEmployeeQueueList: (ctx: McpAuthContext, employeeName: string) => Promise<unknown>;
  aiEmployeeCommand: (
    ctx: McpAuthContext,
    input: { employeeName: string; instruction: string; dryRun: boolean | null },
  ) => Promise<unknown>;
  aiEmployeeChat: (
    ctx: McpAuthContext,
    input: { employeeName: string; message: string },
  ) => Promise<unknown>;
  aiEmployeeScheduleUpdate: (
    ctx: McpAuthContext,
    input: {
      employeeName: string;
      sopCode: string;
      weekday: number;
      startLocal: string;
      dueLocal: string;
      isActive: boolean;
    },
  ) => Promise<unknown>;
  aiEmployeeRoutinesList: (ctx: McpAuthContext, employeeName: string) => Promise<unknown>;
  aiEmployeeRoutineUpsert: (
    ctx: McpAuthContext,
    input: {
      employeeName: string;
      actionCode: string;
      cadence: string;
      weekday: number | null;
      weekdays?: number[] | null;
      timeLocal: string;
      isActive: boolean;
    },
  ) => Promise<unknown>;
  aiEmployeeBriefGet: (ctx: McpAuthContext, employeeName: string) => Promise<unknown>;
  aiEmployeeBriefUpdate: (
    ctx: McpAuthContext,
    employeeName: string,
    brief: {
      serviceIds: string[];
      audience: string;
      personaIds: string[];
      voice: string;
      requiredNotes: string;
      forbiddenNotes: string;
      pillarIds: string[];
      productKnowledgeIds: string[];
      angleIds?: string[];
      repeatVoices?: string[];
      splitRule: string;
    },
  ) => Promise<unknown>;
  listProductKnowledge: (
    ctx: McpAuthContext,
    input: { serviceId: string | null; subServiceId: string | null; search: string | null; limit: number | null },
  ) => Promise<unknown>;
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

function unauthorized(config: McpServiceConfig): Response {
  const metadataUrl = `${config.publicUrl}/.well-known/oauth-protected-resource`;
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer realm="synckerja", resource_metadata="${metadataUrl}"`,
    },
  });
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

  app.get("/health", (c) => c.json({ ok: true }));

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
    if (!claims) return unauthorized(deps.config);
    try {
      const revokedAt = await deps.accessRevokedAt(claims);
      if (isAccessRevoked(claims.iat, revokedAt)) return unauthorized(deps.config);
    } catch {
      return unauthorized(deps.config);
    }
    try {
      return await handleMcpRequest(c.req.raw, claims, {
        ...deps,
        signInventoryConfirmation: (ctx, tool, payload) =>
          signConfirmation(deps.config.jwtSecret, ctx, tool, payload, now()),
        verifyInventoryConfirmation: (ctx, tool, confirmToken) =>
          verifyConfirmation(deps.config.jwtSecret, ctx, tool, confirmToken, now()),
      });
    } catch (error) {
      if (error instanceof AuthzError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  });

  return app;
}
