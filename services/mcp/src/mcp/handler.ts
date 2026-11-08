import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import { AuthzError } from "../authz/errors";
import type { McpAuthContext } from "../authz/context";
import type { ContentPlanRow } from "../db/listContentPlans";
import type { ContentBriefRecord, ContentBriefWrite, ContentCatalogRow } from "../db/contentBriefs";
import type { LeadMagnetDeliveryResult, LeadMagnetDraft } from "../db/leadMagnet";
import type { ThinkingChain, ThinkingCheckResult, ThinkingIdeaRow, ThinkingPlanResult } from "../db/thinkingLab";
import type { ThinkingScriptDraft } from "../tools/thinking/scriptInput";
import type { ThinkingPlanDirectInput } from "../tools/thinking/planDirect";
import type { ThinkingPlanSaveInput } from "../tools/thinking/planSave";
import type { CrmLeadRow, OkrCycleRow, OkrDepartmentRow, OkrObjectiveListRow, OkrObjectiveRow } from "../db/phase1Reads";
import type {
  InboxConversationRow,
  InboxConversationsQuery,
  InboxMessageRow,
  InboxMessagesQuery,
  InboxSummaryQuery,
  InboxSummaryRow,
} from "../tools/inbox/inboxQuery";
import type { CommentsQuery, CommentsSource } from "../tools/comments/commentsQuery";
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
  TaskRecord,
  TaskSummary,
  UpdateTaskInput,
  TaskObjectiveLink,
  TaskStepRecord,
  TaskStepRow,
  TaskSubstepRecord,
  TaskSubstepRow,
  WorkloadRow,
} from "../db/dailyTasks";
import type { HabitCheckInput, HabitCheckResult, HabitDayRow } from "../db/habits";
import type { TaskStepImageRecord } from "../db/stepImages";
import type { SchedulePlanResult } from "../tools/content/plansSchedule";
import type { AccessClaims } from "../oauth/tokens";
import {
  commentsListInput,
  commentsListResult,
  commentsSummaryInput,
  commentsSummaryResult,
  parseCommentsListQuery,
  parseCommentsSummaryQuery,
  inboxConversationsInput,
  inboxConversationsResult,
  inboxMessagesInput,
  inboxMessagesResult,
  inboxSummaryInput,
  inboxSummaryResult,
  parseInboxConversationsQuery,
  parseInboxMessagesQuery,
  parseInboxSummaryQuery,
  adsAccountsInput,
  adsAccountsResult,
  adsPerformanceDenial,
  adsPerformanceInput,
  adsPerformanceResult,
  parseAdsPerformanceQuery,
  adsBreakdownInput,
  adsBreakdownResult,
  parseAdsBreakdownQuery,
  adsAudienceInput,
  adsAudienceResult,
  parseAdsAudienceQuery,
  adsSegmentsInput,
  adsSegmentsResult,
  parseAdsSegmentsQuery,
  calendarInput,
  calendarResult,
  contentPlansInput,
  contentPlansResult,
  createExpenseInput,
  createExpenseResult,
  createIncomeInput,
  createIncomeResult,
  createLeadInput,
  createLeadResult,
  createObjectiveInput,
  createObjectiveResult,
  createPlanInput,
  createPlanResult,
  catalogInput,
  catalogResult,
  createBriefInput,
  createBriefResult,
  cyclesInput,
  cyclesResult,
  departmentsInput,
  departmentsResult,
  createDepartmentObjectiveInput,
  createDepartmentObjectiveResult,
  createIndividualObjectiveInput,
  createIndividualObjectiveResult,
  employeesInput,
  employeesResult,
  expensesInput,
  expensesResult,
  incomeInput,
  incomeResult,
  kolCampaignsInput,
  kolCampaignsResult,
  kolProfilesInput,
  kolProfilesResult,
  leadsInput,
  leadsResult,
  schedulePlanInput,
  schedulePlanResult,
  setLeadStatusInput,
  setLeadStatusResult,
  objectivesInput,
  objectivesResult,
  payrollRunsInput,
  payrollRunsResult,
  posDailyInput,
  posDailyResult,
  stockInput,
  stockResult,
  summaryListInput,
  summaryListResult,
  purchaseOrderInput,
  purchaseOrderInputFromConfirmation,
  purchaseOrderWriteInput,
  ingredientInputFromConfirmation,
  ingredientPreviewInput,
  ingredientWriteInput,
  confirmInput,
  supplierListInput,
  updateExpenseInput,
  updateExpenseResult,
  updateExpenseSchema,
  updateIncomeInput,
  updateIncomeResult,
  updateIncomeSchema,
  updateLeadInput,
  updateLeadResult,
  updateLeadSchema,
  updateObjectiveInput,
  updateObjectiveResult,
  updateObjectiveSchema,
  updatePlanInput,
  updatePlanResult,
  updatePlanSchema,
  visitsInput,
  visitsResult,
  whoamiInput,
  whoamiResult,
  orgsListInput,
  orgsListResult,
  switchOrgInput,
  switchOrgResult,
  stampOrganization,
  taskSummaryInput,
  taskSummaryResult,
  taskListInput,
  taskListResult,
  taskInitiativeInput,
  taskInitiativeResult,
  taskWorkloadInput,
  taskWorkloadResult,
  completedStepsInput,
  completedStepsResult,
  createTaskInput,
  createTaskResult,
  updateTaskInput,
  updateTaskResult,
  updateTaskSchema,
  deleteTaskInput,
  deleteTaskResult,
  assignTaskInput,
  assignTaskResult,
  linkTaskObjectiveInput,
  linkTaskObjectiveResult,
  takeInitiativeInput,
  takeInitiativeResult,
  taskStepsInput,
  taskStepsResult,
  createStepInput,
  createStepResult,
  updateStepResult,
  updateStepSchema,
  deleteStepInput,
  deleteStepResult,
  createSubstepInput,
  createSubstepResult,
  listSubstepsInput,
  listSubstepsResult,
  addStepImageInput,
  addStepImageResult,
  draftReadInput,
  draftReadResult,
  deliveryAttachInput,
  deliveryAttachResult,
  ideasListInput,
  ideasListResult,
  chainReadInput,
  chainReadResult,
  executionCheckInput,
  executionCheckResult,
  planSaveInput,
  planSaveResult,
  planDirectInput,
  planDirectResult,
  habitsListInput,
  habitsListResult,
  habitCheckInput,
  habitCheckResult,
  aiEmployeeListInput,
  aiEmployeeNameInput,
  aiEmployeeRunsInput,
  aiEmployeeReportInput,
  aiEmployeeCommandInput,
  aiEmployeeChatInput,
  aiEmployeeBriefGetInput,
  aiEmployeeBriefUpdateInput,
  productKnowledgeListInput,
  aiEmployeeRoutineUpsertInput,
  aiEmployeeScheduleUpdateInput,
} from "../tools";
import type { ToolCallOutcome } from "../db/toolGate";
import { filterTools, isToolVisible } from "./filterTools";
import { MCP_SERVER_INSTRUCTIONS } from "./instructions";
import type { McpToolName } from "./registry";

export type McpReadDeps = {
  listContentPlans: (ctx: McpAuthContext) => Promise<ContentPlanRow[]>;
  listContentCalendar: (ctx: McpAuthContext, month: string | null) => Promise<ContentPlanRow[]>;
  listContentCatalog: (ctx: McpAuthContext) => Promise<ContentCatalogRow[]>;
  listOkrCycles: (ctx: McpAuthContext) => Promise<OkrCycleRow[]>;
  listOkrObjectives: (ctx: McpAuthContext, cycleId: string | null) => Promise<OkrObjectiveListRow[]>;
  listOkrDepartments: (ctx: McpAuthContext) => Promise<OkrDepartmentRow[]>;
  listCrmLeads: (ctx: McpAuthContext, status: string | null) => Promise<CrmLeadRow[]>;
  listInboxConversations: (ctx: McpAuthContext, query: InboxConversationsQuery) => Promise<InboxConversationRow[]>;
  listInboxMessages: (ctx: McpAuthContext, query: InboxMessagesQuery) => Promise<InboxMessageRow[]>;
  readInboxSummary: (ctx: McpAuthContext, query: InboxSummaryQuery) => Promise<InboxSummaryRow[]>;
  readSocialComments: (ctx: McpAuthContext, query: CommentsQuery) => Promise<CommentsSource>;
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
  signInventoryConfirmation: (
    ctx: McpAuthContext,
    tool: import("../tools/inventory/confirmation").ConfirmableTool,
    payload: Record<string, unknown>,
  ) => Promise<import("../tools/inventory/confirmation").SignedConfirmation>;
  verifyInventoryConfirmation: (
    ctx: McpAuthContext,
    tool: import("../tools/inventory/confirmation").ConfirmableTool,
    token: string,
  ) => Promise<import("../tools/inventory/confirmation").VerifiedConfirmation>;
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
  switchOrganization: (ctx: McpAuthContext, organizationId: string) => Promise<void>;
};

type HandlerDeps = McpReadDeps & {
  loadContext: (claims: AccessClaims) => Promise<McpAuthContext>;
  takeToolSlot: (ctx: McpAuthContext) => Promise<{ allowed: boolean; recordDenial: boolean }>;
  recordToolCall: (ctx: McpAuthContext, toolName: string, outcome: ToolCallOutcome) => Promise<void>;
};

type ToolArgs = Record<string, unknown>;

const CONFIRM_NEXT_STEP =
  "Nothing is saved yet. Show every field of this summary to the user, including category_display, and ask them to confirm this one write. "
  + "Call the create tool with this confirm_token only after they clearly say yes to this summary. "
  + "One yes confirms one write: do not save a second write (for example a purchase order) on the same yes; preview it and ask again.";

function forbidden() {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: "forbidden" }],
  };
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("invalid_input");
  return value;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("invalid_input");
  return value;
}

function requiredNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("invalid_input");
  return value;
}

async function noteCall(
  deps: HandlerDeps,
  ctx: McpAuthContext,
  toolName: McpToolName,
  outcome: ToolCallOutcome,
): Promise<void> {
  try {
    await deps.recordToolCall(ctx, toolName, outcome);
  } catch {
    // A missed audit row does not hide a finished tool result or turn a denial into a success.
  }
}

async function reload(deps: HandlerDeps, claims: AccessClaims): Promise<McpAuthContext | null> {
  try {
    return await deps.loadContext(claims);
  } catch (error) {
    if (error instanceof AuthzError) return null;
    throw error;
  }
}

/** SDK `registerTool` wraps this shape with `z.object`. Passing the Zod object itself drops `plan_month`. */
export function publishedToolShape(schema: ZodTypeAny): ZodRawShape {
  if (schema instanceof z.ZodObject) return schema.shape;
  if (schema instanceof z.ZodEffects) {
    const inner = schema.innerType();
    if (inner instanceof z.ZodObject) return inner.shape;
  }
  throw new Error("invalid_tool_schema");
}

const toolInputs: Record<McpToolName, ZodTypeAny> = {
  "session.whoami": whoamiInput,
  "session.orgs.list": orgsListInput,
  "session.switchOrg": switchOrgInput,
  "content.plans.list": contentPlansInput,
  "content.calendar.list": calendarInput,
  "content.catalog.list": catalogInput,
  "okr.cycles.list": cyclesInput,
  "okr.objectives.list": objectivesInput,
  "okr.departments.list": departmentsInput,
  "crm.leads.list": leadsInput,
  "inbox.conversations.list": inboxConversationsInput,
  "inbox.messages.list": inboxMessagesInput,
  "inbox.summary": inboxSummaryInput,
  "comments.list": commentsListInput,
  "comments.summary": commentsSummaryInput,
  "ads.accounts.list": adsAccountsInput,
  "ads.performance.summary": adsPerformanceInput,
  "ads.performance.breakdown": adsBreakdownInput,
  "ads.audience.list": adsAudienceInput,
  "ads.performance.segments": adsSegmentsInput,
  "finance.income.list": incomeInput,
  "finance.income.create": createIncomeInput,
  "finance.income.update": updateIncomeSchema,
  "finance.expenses.list": expensesInput,
  "finance.expenses.create": createExpenseInput,
  "finance.expenses.update": updateExpenseSchema,
  "hr.employees.list": employeesInput,
  "payroll.runs.list": payrollRunsInput,
  "sales.visits.list": visitsInput,
  "pos.sales.daily": posDailyInput,
  "kol.campaigns.list": kolCampaignsInput,
  "kol.profiles.list": kolProfilesInput,
  "inventory.stock.list": stockInput,
  "inventory.summary.list": summaryListInput,
  "inventory.suppliers.list": supplierListInput,
  "inventory.purchase_order.preview": purchaseOrderInput,
  "inventory.purchase_order.create": confirmInput,
  "inventory.ingredient.preview": ingredientPreviewInput,
  "inventory.ingredient.create": confirmInput,
  "content.plans.create": createPlanInput,
  "content.briefs.create": createBriefInput,
  "content.plans.update": updatePlanSchema,
  "okr.objectives.create": createObjectiveInput,
  "okr.objectives.update": updateObjectiveSchema,
  "okr.objectives.department.create": createDepartmentObjectiveInput,
  "okr.objectives.individual.create": createIndividualObjectiveInput,
  "crm.leads.create": createLeadInput,
  "crm.leads.update": updateLeadSchema,
  "content.plans.schedule": schedulePlanInput,
  "leadmagnet.draft.read": draftReadInput,
  "leadmagnet.delivery.attach": deliveryAttachInput,
  "crm.leads.setStatus": setLeadStatusInput,
  "tasks.summary": taskSummaryInput,
  "tasks.list": taskListInput,
  "tasks.initiative.list": taskInitiativeInput,
  "tasks.workload": taskWorkloadInput,
  "tasks.completed.list": completedStepsInput,
  "tasks.create": createTaskInput,
  "tasks.update": updateTaskSchema,
  "tasks.delete": deleteTaskInput,
  "tasks.assign": assignTaskInput,
  "tasks.objective.link": linkTaskObjectiveInput,
  "tasks.initiative.take": takeInitiativeInput,
  "tasks.steps.list": taskStepsInput,
  "tasks.steps.create": createStepInput,
  "tasks.steps.update": updateStepSchema,
  "tasks.steps.delete": deleteStepInput,
  "tasks.substeps.list": listSubstepsInput,
  "tasks.substeps.create": createSubstepInput,
  "tasks.steps.image.add": addStepImageInput,
  "habits.list": habitsListInput,
  "habits.check": habitCheckInput,
  "thinking.ideas.list": ideasListInput,
  "thinking.chain.read": chainReadInput,
  "thinking.execution.check": executionCheckInput,
  "thinking.plan.save": planSaveInput,
  "thinking.plan.direct": planDirectInput,
  "ai_employee.list": aiEmployeeListInput,
  "ai_employee.status": aiEmployeeNameInput,
  "ai_employee.runs.list": aiEmployeeRunsInput,
  "ai_employee.report": aiEmployeeReportInput,
  "ai_employee.queue.list": aiEmployeeNameInput,
  "ai_employee.command": aiEmployeeCommandInput,
  "ai_employee.chat": aiEmployeeChatInput,
  "ai_employee.schedule.update": aiEmployeeScheduleUpdateInput,
  "ai_employee.routines.list": aiEmployeeNameInput,
  "ai_employee.routine.upsert": aiEmployeeRoutineUpsertInput,
  "ai_employee.brief.get": aiEmployeeBriefGetInput,
  "ai_employee.brief.update": aiEmployeeBriefUpdateInput,
  "product_knowledge.list": productKnowledgeListInput,
};

async function runTool(
  name: McpToolName,
  ctx: McpAuthContext,
  args: ToolArgs,
  deps: HandlerDeps,
  claims: AccessClaims,
): Promise<unknown> {
  switch (name) {
    case "session.whoami":
      return whoamiResult(ctx);
    case "session.orgs.list":
      return orgsListResult(ctx);
    case "session.switchOrg":
      if (!switchOrgInput.safeParse(args).success) throw new Error("invalid_input");
      return switchOrgResult(ctx, args, {
        switchOrganization: (organizationId) => deps.switchOrganization(ctx, organizationId),
        reload: async () => {
          const next = await reload(deps, claims);
          if (!next) throw new Error("not_a_member");
          return next;
        },
      });
    case "content.plans.list":
      return contentPlansResult(ctx, deps.listContentPlans);
    case "content.calendar.list":
      return calendarResult(ctx, optionalString(args.month), deps.listContentCalendar);
    case "content.catalog.list":
      return catalogResult(ctx, deps.listContentCatalog);
    case "okr.cycles.list":
      return cyclesResult(ctx, deps.listOkrCycles);
    case "okr.objectives.list":
      return objectivesResult(ctx, optionalString(args.cycle_id), deps.listOkrObjectives);
    case "okr.departments.list":
      return departmentsResult(ctx, deps.listOkrDepartments);
    case "crm.leads.list":
      return leadsResult(ctx, optionalString(args.status), deps.listCrmLeads);
    case "inbox.conversations.list": {
      const query = parseInboxConversationsQuery(args);
      if (!query) throw new Error("invalid_input");
      return inboxConversationsResult(ctx, query, deps.listInboxConversations);
    }
    case "inbox.messages.list": {
      const query = parseInboxMessagesQuery(args);
      if (!query) throw new Error("invalid_input");
      return inboxMessagesResult(ctx, query, deps.listInboxMessages);
    }
    case "inbox.summary": {
      const query = parseInboxSummaryQuery(args);
      if (!query) throw new Error("invalid_input");
      return inboxSummaryResult(ctx, query, deps.readInboxSummary);
    }
    case "comments.list": {
      const query = parseCommentsListQuery(args);
      if (!query) throw new Error("invalid_input");
      return commentsListResult(ctx, query, deps.readSocialComments);
    }
    case "comments.summary": {
      const query = parseCommentsSummaryQuery(args);
      if (!query) throw new Error("invalid_input");
      return commentsSummaryResult(ctx, query, deps.readSocialComments);
    }
    case "ads.accounts.list":
      return adsAccountsResult(ctx, deps.listAdsAccounts);
    case "ads.performance.summary": {
      const query = parseAdsPerformanceQuery(args);
      if (!query) throw new Error("invalid_input");
      return adsPerformanceResult(ctx, query, deps.listAdsPerformance);
    }
    case "ads.performance.breakdown": {
      const query = parseAdsBreakdownQuery(args);
      if (!query) throw new Error("invalid_input");
      return adsBreakdownResult(ctx, query, deps.listAdsBreakdown);
    }
    case "ads.audience.list": {
      const query = parseAdsAudienceQuery(args);
      if (!query) throw new Error("invalid_input");
      return adsAudienceResult(ctx, query, deps.listAdsAudience);
    }
    case "ads.performance.segments": {
      const query = parseAdsSegmentsQuery(args);
      if (!query) throw new Error("invalid_input");
      return adsSegmentsResult(ctx, query, deps.listAdsSegments);
    }
    case "finance.income.list":
      return incomeResult(ctx, optionalString(args.month), deps.listIncomeTransactions);
    case "finance.expenses.list":
      return expensesResult(ctx, optionalString(args.month), deps.listExpenses);
    case "finance.income.create":
      return createIncomeResult(
        ctx,
        {
          transactionDate: requiredString(args.transaction_date),
          amount: requiredNumber(args.amount),
          customerName: optionalString(args.customer_name),
          paymentMethod: optionalString(args.payment_method),
          description: optionalString(args.description),
        },
        deps.createIncomeTransaction,
      );
    case "finance.income.update":
      if (!updateIncomeInput.safeParse(args).success) throw new Error("invalid_input");
      return updateIncomeResult(
        ctx,
        {
          id: requiredString(args.id),
          transactionDate: optionalString(args.transaction_date),
          amount: optionalNumber(args.amount),
          customerName: optionalString(args.customer_name),
          paymentMethod: optionalString(args.payment_method),
          description: optionalString(args.description),
        },
        deps.updateIncomeTransaction,
      );
    case "finance.expenses.create":
      return createExpenseResult(
        ctx,
        {
          expenseName: requiredString(args.expense_name),
          amount: requiredNumber(args.amount),
          createDate: requiredString(args.create_date),
          expenseType: requiredString(args.expense_type),
          category: requiredString(args.category),
          description: optionalString(args.description),
        },
        deps.createExpenseRecord,
      );
    case "finance.expenses.update":
      if (!updateExpenseInput.safeParse(args).success) throw new Error("invalid_input");
      return updateExpenseResult(
        ctx,
        {
          id: requiredString(args.id),
          expenseName: optionalString(args.expense_name),
          amount: optionalNumber(args.amount),
          createDate: optionalString(args.create_date),
          expenseType: optionalString(args.expense_type),
          category: optionalString(args.category),
          description: optionalString(args.description),
        },
        deps.updateExpenseRecord,
      );
    case "hr.employees.list":
      return employeesResult(ctx, deps.listEmployees);
    case "payroll.runs.list":
      return payrollRunsResult(ctx, optionalString(args.month), deps.listPayrollRuns);
    case "sales.visits.list":
      return visitsResult(ctx, optionalString(args.month), deps.listCustomerVisits);
    case "pos.sales.daily":
      return posDailyResult(ctx, optionalString(args.month), deps.listPosDailySales);
    case "kol.campaigns.list":
      return kolCampaignsResult(ctx, deps.listKolCampaigns);
    case "kol.profiles.list":
      return kolProfilesResult(ctx, deps.listKolProfiles);
    case "inventory.stock.list":
      return stockResult(ctx, deps.listInventoryStock);
    case "inventory.summary.list": {
      const parsed = summaryListInput.safeParse(args ?? {});
      if (!parsed.success) throw new Error("invalid_input");
      return summaryListResult(ctx, {
        outletId: parsed.data.outlet_id ?? null,
        kind: parsed.data.kind ?? null,
        dateStart: parsed.data.date_start ?? null,
        dateEnd: parsed.data.date_end ?? null,
        search: parsed.data.search ?? null,
      }, deps.listInventorySummary);
    }
    case "inventory.suppliers.list": {
      const parsed = supplierListInput.safeParse(args ?? {});
      if (!parsed.success) throw new Error("invalid_input");
      const search = parsed.data.search ? parsed.data.search : null;
      const suppliers = await deps.listCatalogSuppliers(ctx, search);
      return {
        search,
        suppliers,
        how_to_read: suppliers.length === 0
          ? "No supplier matches. Tell the user; suppliers are added on the Inventory page. Do not invent a supplier_id. You may record the purchase with No Supplier only if the user agrees."
          : "Pass the id of the supplier the user meant as supplier_id. If more than one could match, ask the user which one.",
      };
    }
    case "inventory.purchase_order.preview": {
      const parsed = purchaseOrderInput.safeParse(args ?? {});
      if (!parsed.success) throw new Error("invalid_input");
      const input = purchaseOrderWriteInput(parsed.data);
      const preview = await deps.previewInventoryPurchaseOrder(ctx, input);
      const signed = await deps.signInventoryConfirmation(ctx, "inventory.purchase_order.create", { ...input });
      return { ...preview, ...signed, next_step: CONFIRM_NEXT_STEP };
    }
    case "inventory.purchase_order.create": {
      const parsed = confirmInput.safeParse(args ?? {});
      if (!parsed.success) throw new Error("invalid_input");
      const verified = await deps.verifyInventoryConfirmation(
        ctx,
        "inventory.purchase_order.create",
        parsed.data.confirm_token,
      );
      const input = purchaseOrderInputFromConfirmation(verified.payload);
      return deps.createInventoryPurchaseOrder(ctx, input, verified.confirmId);
    }
    case "inventory.ingredient.preview": {
      const parsed = ingredientPreviewInput.safeParse(args ?? {});
      if (!parsed.success) {
        const codes = parsed.error.issues.map((issue) => issue.message);
        if (codes.includes("ingredient_category_choice_required")) throw new Error("ingredient_category_choice_required");
        if (codes.includes("ingredient_cost_required")) throw new Error("ingredient_cost_required");
        throw new Error("invalid_input");
      }
      const input = ingredientWriteInput(parsed.data);
      const preview = await deps.writeInventoryIngredient(ctx, input, null);
      const signed = await deps.signInventoryConfirmation(ctx, "inventory.ingredient.create", { ...input });
      return {
        ...preview,
        category_display: preview.category_name
          ? `${preview.category_name}${preview.category_is_new ? " (new category)" : ""}`
          : "(no category)",
        ...signed,
        next_step: CONFIRM_NEXT_STEP,
      };
    }
    case "inventory.ingredient.create": {
      const parsed = confirmInput.safeParse(args ?? {});
      if (!parsed.success) throw new Error("invalid_input");
      const verified = await deps.verifyInventoryConfirmation(
        ctx,
        "inventory.ingredient.create",
        parsed.data.confirm_token,
      );
      const input = ingredientInputFromConfirmation(verified.payload);
      return deps.writeInventoryIngredient(ctx, input, verified.confirmId);
    }
    case "content.plans.create":
      return createPlanResult(
        ctx,
        {
          title: requiredString(args.title),
          postDate: optionalString(args.post_date),
          brief: optionalString(args.brief),
        },
        deps.createContentPlan,
      );
    case "content.briefs.create": {
      const parsed = createBriefInput.safeParse(args);
      if (!parsed.success) throw new Error("invalid_input");
      const data = parsed.data;
      const blank = (value: string | undefined) => value ?? "";
      return createBriefResult(
        ctx,
        {
          title: data.title,
          postDate: data.post_date ?? null,
          contentTypeId: data.content_type_id,
          serviceId: data.service_id ?? null,
          subServiceId: data.sub_service_id ?? null,
          featureId: data.feature_id ?? null,
          postAspect: data.post_aspect ?? null,
          voiceOver: data.voice_over ?? null,
          characters: data.characters ?? [],
          locations: data.locations ?? [],
          properties: data.properties ?? [],
          caption: data.caption ?? null,
          sequences: data.sequences.map((sequence) => ({
            name: sequence.name,
            shots: sequence.shots.map((shot) => ({
              timing: blank(shot.timing),
              visual: blank(shot.visual),
              vo: blank(shot.vo),
              element: blank(shot.element),
              tagging: blank(shot.tagging),
            })),
          })),
        },
        deps.createContentBrief,
      );
    }
    case "content.plans.update":
      if (!updatePlanInput.safeParse(args).success) throw new Error("invalid_input");
      return updatePlanResult(
        ctx,
        {
          id: requiredString(args.id),
          title: optionalString(args.title),
          postDate: optionalString(args.post_date),
          brief: optionalString(args.brief),
        },
        deps.updateContentPlan,
      );
    case "okr.objectives.create":
      return createObjectiveResult(
        ctx,
        {
          cycleId: requiredString(args.cycle_id),
          title: requiredString(args.title),
          whyImportant: optionalString(args.why_important),
          status: optionalString(args.status),
        },
        deps.createCompanyObjective,
      );
    case "okr.objectives.update":
      if (!updateObjectiveInput.safeParse(args).success) throw new Error("invalid_input");
      return updateObjectiveResult(
        ctx,
        {
          id: requiredString(args.id),
          level: requiredString(args.level) as "company" | "department" | "individual",
          title: optionalString(args.title),
          status: optionalString(args.status),
        },
        deps.updateObjective,
      );
    case "okr.objectives.department.create":
      return createDepartmentObjectiveResult(
        ctx,
        {
          companyObjectiveId: requiredString(args.company_objective_id),
          departmentId: requiredString(args.department_id),
          title: requiredString(args.title),
          description: optionalString(args.description),
          status: optionalString(args.status),
        },
        deps.createDepartmentObjective,
      );
    case "okr.objectives.individual.create":
      return createIndividualObjectiveResult(
        ctx,
        {
          departmentObjectiveId: requiredString(args.department_objective_id),
          title: requiredString(args.title),
          description: optionalString(args.description),
          status: optionalString(args.status),
          employeeId: optionalString(args.employee_id),
        },
        deps.createIndividualObjective,
      );
    case "crm.leads.create":
      return createLeadResult(
        ctx,
        {
          client: requiredString(args.client),
          title: requiredString(args.title),
          category: requiredString(args.category),
          source: optionalString(args.source),
          fuPriority: optionalString(args.fu_priority),
          status: optionalString(args.status),
        },
        deps.createLead,
      );
    case "crm.leads.update":
      if (!updateLeadInput.safeParse(args).success) throw new Error("invalid_input");
      return updateLeadResult(
        ctx,
        {
          id: requiredString(args.id),
          client: optionalString(args.client),
          title: optionalString(args.title),
          category: optionalString(args.category),
          source: optionalString(args.source),
          fuPriority: optionalString(args.fu_priority),
        },
        deps.updateLead,
      );
    case "content.plans.schedule":
      return schedulePlanResult(ctx, requiredString(args.id), deps.scheduleContentPlan);
    case "leadmagnet.draft.read":
      return draftReadResult(ctx, optionalString(args.campaign_id), deps.listLeadMagnetDrafts);
    case "leadmagnet.delivery.attach":
      return deliveryAttachResult(
        ctx,
        { campaignId: requiredString(args.campaign_id), fileUrl: requiredString(args.file_url) },
        deps.attachLeadMagnetDelivery,
      );
    case "crm.leads.setStatus":
      return setLeadStatusResult(
        ctx,
        { id: requiredString(args.id), status: requiredString(args.status) },
        deps.setLeadStatus,
      );
    case "tasks.summary":
      return taskSummaryResult(ctx, optionalString(args.month), deps.listTaskSummary);
    case "tasks.list":
      return taskListResult(ctx, optionalString(args.status), optionalString(args.month), deps.listTasks);
    case "tasks.initiative.list":
      return taskInitiativeResult(ctx, deps.listTaskInitiative);
    case "tasks.workload":
      return taskWorkloadResult(ctx, optionalString(args.timeframe), deps.listTaskWorkload);
    case "tasks.completed.list":
      return completedStepsResult(ctx, optionalString(args.month), deps.listCompletedSteps);
    case "tasks.create":
      return createTaskResult(
        ctx,
        {
          title: requiredString(args.title),
          description: optionalString(args.description),
          priority: optionalString(args.priority),
          dueDate: optionalString(args.due_date),
          employeeId: optionalString(args.employee_id),
          planMonth: requiredString(args.plan_month),
        },
        deps.createTask,
      );
    case "tasks.update":
      if (!updateTaskInput.safeParse(args).success) throw new Error("invalid_input");
      return updateTaskResult(
        ctx,
        {
          id: requiredString(args.id),
          title: optionalString(args.title),
          priority: optionalString(args.priority),
          dueDate: optionalString(args.due_date),
          planMonth: optionalString(args.plan_month),
        },
        deps.updateTask,
      );
    case "tasks.delete":
      return deleteTaskResult(ctx, requiredString(args.id), deps.deleteTask);
    case "tasks.assign":
      return assignTaskResult(
        ctx,
        {
          id: requiredString(args.id),
          employeeId: requiredString(args.employee_id),
          dueDate: optionalString(args.due_date),
        },
        deps.assignTask,
      );
    case "tasks.objective.link":
      return linkTaskObjectiveResult(
        ctx,
        {
          taskId: requiredString(args.task_id),
          individualObjectiveId: requiredString(args.individual_objective_id),
        },
        deps.linkTaskObjective,
      );
    case "tasks.initiative.take":
      return takeInitiativeResult(
        ctx,
        {
          id: requiredString(args.id),
          level: requiredString(args.level),
          dueDate: requiredString(args.due_date),
          employeeId: optionalString(args.employee_id),
        },
        deps.takeTaskInitiative,
      );
    case "tasks.steps.list":
      return taskStepsResult(ctx, requiredString(args.task_id), deps.listTaskSteps);
    case "tasks.steps.create":
      return createStepResult(
        ctx,
        {
          taskId: requiredString(args.task_id),
          title: requiredString(args.title),
          description: optionalString(args.description),
        },
        deps.createTaskStep,
      );
    case "tasks.steps.update":
      return updateStepResult(
        ctx,
        {
          id: requiredString(args.id),
          title: requiredString(args.title),
          description: typeof args.description === "string" ? args.description : null,
        },
        deps.updateTaskStep,
      );
    case "tasks.steps.delete":
      return deleteStepResult(ctx, requiredString(args.id), deps.deleteTaskStep);
    case "tasks.substeps.list":
      return listSubstepsResult(ctx, requiredString(args.step_id), deps.listTaskSubsteps);
    case "tasks.substeps.create":
      return createSubstepResult(
        ctx,
        { stepId: requiredString(args.step_id), title: requiredString(args.title) },
        deps.createTaskSubstep,
      );
    case "tasks.steps.image.add":
      return addStepImageResult(
        ctx,
        { stepId: requiredString(args.step_id), imageUrl: requiredString(args.image_url) },
        deps.attachTaskStepImage,
      );
    case "habits.list":
      return habitsListResult(ctx, optionalString(args.date), deps.listHabits);
    case "thinking.ideas.list":
      return ideasListResult(ctx, deps.listThinkingIdeas);
    case "thinking.chain.read":
      return chainReadResult(ctx, requiredString(args.idea_id), deps.readThinkingChain);
    case "thinking.execution.check":
      return executionCheckResult(ctx, args, deps.checkThinkingExecution);
    case "thinking.plan.save":
      return planSaveResult(ctx, args, deps.saveThinkingPlan);
    case "thinking.plan.direct":
      return planDirectResult(ctx, args, deps.saveThinkingPlanDirect);
    case "habits.check":
      return habitCheckResult(
        ctx,
        {
          habitId: requiredString(args.habit_id),
          checked: requiredBoolean(args.checked),
          date: optionalString(args.date),
          index: optionalNumber(args.index),
        },
        deps.checkHabit,
      );
    case "ai_employee.list":
      return deps.listAiEmployees(ctx);
    case "ai_employee.status":
      return deps.aiEmployeeStatus(ctx, requiredString(args.employee_name));
    case "ai_employee.runs.list":
      return deps.aiEmployeeRuns(ctx, requiredString(args.employee_name), optionalNumber(args.limit));
    case "ai_employee.report":
      return deps.aiEmployeeReport(ctx, requiredString(args.employee_name), requiredString(args.period));
    case "ai_employee.queue.list":
      return deps.aiEmployeeQueueList(ctx, requiredString(args.employee_name));
    case "ai_employee.command":
      return deps.aiEmployeeCommand(ctx, {
        employeeName: requiredString(args.employee_name),
        instruction: requiredString(args.instruction),
        dryRun: typeof args.dry_run === "boolean" ? args.dry_run : null,
      });
    case "ai_employee.chat":
      return deps.aiEmployeeChat(ctx, {
        employeeName: requiredString(args.employee_name),
        message: requiredString(args.message),
      });
    case "ai_employee.schedule.update":
      return deps.aiEmployeeScheduleUpdate(ctx, {
        employeeName: requiredString(args.employee_name),
        sopCode: requiredString(args.sop_code),
        weekday: requiredNumber(args.weekday),
        startLocal: requiredString(args.start_local),
        dueLocal: requiredString(args.due_local),
        isActive: requiredBoolean(args.is_active),
      });
    case "ai_employee.routines.list":
      return deps.aiEmployeeRoutinesList(ctx, requiredString(args.employee_name));
    case "ai_employee.routine.upsert":
      return deps.aiEmployeeRoutineUpsert(ctx, {
        employeeName: requiredString(args.employee_name),
        actionCode: requiredString(args.action_code),
        cadence: requiredString(args.cadence),
        weekday: optionalNumber(args.weekday),
        weekdays: Array.isArray(args.weekdays) ? args.weekdays.filter((day): day is number => typeof day === "number") : null,
        timeLocal: requiredString(args.time_local),
        isActive: requiredBoolean(args.is_active),
      });
    case "ai_employee.brief.get":
      return deps.aiEmployeeBriefGet(ctx, requiredString(args.employee_name));
    case "ai_employee.brief.update":
      return deps.aiEmployeeBriefUpdate(ctx, requiredString(args.employee_name), {
        serviceIds: Array.isArray(args.service_ids) ? args.service_ids.map((id) => String(id)) : [],
        audience: typeof args.audience === "string" ? args.audience : "",
        personaIds: Array.isArray(args.persona_ids) ? args.persona_ids.map((id) => String(id)) : [],
        voice: typeof args.voice === "string" ? args.voice : "",
        requiredNotes: typeof args.required_notes === "string" ? args.required_notes : "",
        forbiddenNotes: typeof args.forbidden_notes === "string" ? args.forbidden_notes : "",
        pillarIds: Array.isArray(args.pillar_ids) ? args.pillar_ids.map((id) => String(id)) : [],
        productKnowledgeIds: Array.isArray(args.product_knowledge_ids) ? args.product_knowledge_ids.map((id) => String(id)) : [],
        ...(Array.isArray(args.angle_ids) ? { angleIds: args.angle_ids.map((id) => String(id)) } : {}),
        ...(Array.isArray(args.repeat_voices)
          ? {
              repeatVoices: args.repeat_voices
                .map((voice) => String(voice).trim())
                .filter((voice) => voice.length > 0)
                .slice(0, 3),
            }
          : {}),
        splitRule: typeof args.split_rule === "string" ? args.split_rule : "",
      });
    case "product_knowledge.list":
      return deps.listProductKnowledge(ctx, {
        serviceId: optionalString(args.service_id),
        subServiceId: optionalString(args.sub_service_id),
        search: optionalString(args.search),
        limit: optionalNumber(args.limit),
      });
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

  const server = new McpServer(
    { name: "synckerja", version: "0.1.0" },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  );
  for (const tool of filterTools(ctx)) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: publishedToolShape(toolInputs[tool.name]) },
      async (args) => {
        const slot = ctx.membershipActive
          ? await deps.takeToolSlot(ctx)
          : { allowed: true, recordDenial: false };
        if (!slot.allowed) {
          if (slot.recordDenial) await noteCall(deps, ctx, tool.name, "rate_limited");
          return { isError: true as const, content: [{ type: "text" as const, text: "rate_limited" }] };
        }
        const fresh = await reload(deps, claims);
        if (!fresh || !isToolVisible(tool.name, fresh)) {
          await noteCall(deps, fresh ?? ctx, tool.name, "forbidden");
          if (tool.name.startsWith("ads.performance.") || tool.name === "ads.audience.list") {
            const message = adsPerformanceDenial(fresh);
            console.error(`${tool.name}: denied`, {
              reason: message,
              organizationId: fresh?.organizationId ?? ctx.organizationId,
              userId: fresh?.userId ?? ctx.userId,
            });
            return {
              isError: true as const,
              content: [{ type: "text" as const, text: message }],
            };
          }
          return forbidden();
        }
        try {
          const body = await runTool(tool.name, fresh, (args ?? {}) as ToolArgs, deps, claims);
          const stamped = tool.mutates ? stampOrganization(body, fresh) : body;
          await noteCall(deps, fresh, tool.name, "ok");
          return { content: [{ type: "text" as const, text: JSON.stringify(stamped) }] };
        } catch (error) {
          await noteCall(deps, fresh, tool.name, "error");
          throw error;
        }
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
