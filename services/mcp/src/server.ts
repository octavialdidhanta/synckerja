import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { loadContext } from "./authz/loadContext";
import { createAdmin } from "./db/admin";
import { isActiveMember, loadConsentIdentity, verifySupabaseUser } from "./db/identity";
import { listContentPlans } from "./db/listContentPlans";
import { createContentBrief, confirmContentBrief, getContentBrief, listContentCatalog, readContentBriefForUpdate } from "./db/contentBriefs";
import { downloadVoiceClip, generateBriefVoiceClip, getBriefVoiceClip, listBriefVoiceClips } from "./db/briefVoice";
import { voiceDownloadKey } from "./tools/content/voiceDownload";
import { attachLeadMagnetDelivery, listLeadMagnetDrafts } from "./db/leadMagnet";
import {
  checkThinkingExecution,
  listThinkingIdeas,
  listThinkingMasters,
  readThinkingTree,
  readThinkingChain,
  saveThinkingPlan,
  saveThinkingPlanDirect,
} from "./db/thinkingLab";
import { addThinkingTerritory, lockThinkingTerritories } from "./db/thinkingTerritory";
import { addThinkingAngle, lockThinkingAngles } from "./db/thinkingAngle";
import { addThinkingIdea, lockThinkingIdeas } from "./db/thinkingIdea";
import { recommendThinkingPillars, removeThinkingPillar, setThinkingPillar } from "./db/thinkingPillar";
import { readThinkingDefinitions } from "./db/thinkingDefinitions";
import {
  updateThinkingAngle,
  updateThinkingBigThought,
  updateThinkingIdea,
  updateThinkingMaster,
  updateThinkingTerritory,
} from "./db/thinkingUpdate";
import {
  addThinkingBigThought,
  createThinkingMaster,
  lockThinkingBigThoughts,
  setThinkingMasterCatalog,
} from "./db/thinkingWrite";
import { listContentCalendar, listCrmLeads, listOkrCycles, listOkrDepartments, listOkrObjectives } from "./db/phase1Reads";
import {
  listAdsAccounts,
  listCustomerVisits,
  listEmployees,
  listExpenses,
  listIncomeTransactions,
  listInventoryStock,
  listKolCampaigns,
  listKolProfiles,
} from "./db/phase2Reads";
import { listInventorySummary } from "./db/inventorySummary";
import { createInventoryPurchaseOrder, previewInventoryPurchaseOrder } from "./db/inventoryPurchaseOrder";
import { createIngredientProduction, previewIngredientProduction } from "./db/inventoryProduction";
import { createStockAdjustment, previewStockAdjustment } from "./db/inventoryAdjustment";
import {
  listOpenPurchaseOrders,
  previewReceivePurchaseOrder,
  receivePurchaseOrder,
} from "./db/inventoryPurchaseOrderReceive";
import { writeCatalogIngredient } from "./db/inventoryIngredient";
import { listCatalogSuppliers } from "./db/inventorySuppliers";
import { listRecipeCosts } from "./db/recipeCosts";
import { createRecipeDraft, listRecipeDrafts } from "./db/recipeDrafts";
import { listAdsAudience, listAdsBreakdown, listAdsPerformance, listAdsSegments } from "./db/adsPerformance";
import { setContentPlanDriveLink } from "./db/planDriveLink";
import { getUploadStatus, listMediaVersions, putUploadChunk, startMediaUpload } from "./db/mediaUpload";
import {
  createCompanyObjective,
  createContentPlan,
  createDepartmentObjective,
  createIndividualObjective,
  createLead,
  setLeadStatus,
  updateContentPlan,
  updateLead,
  updateObjective,
} from "./db/phase3Writes";
import {
  createExpenseRecord,
  createIncomeTransaction,
  updateExpenseRecord,
  updateIncomeTransaction,
} from "./db/phase5Writes";
import { listPayrollRuns, listPosDailySales } from "./db/payrollPosReads";
import {
  assignTask,
  createTask,
  deleteTask,
  linkTaskObjective,
  listCompletedSteps,
  listTaskInitiative,
  listTaskSummary,
  listTasks,
  listTaskWorkload,
  takeTaskInitiative,
  updateTask,
  createTaskStep,
  createTaskSubstep,
  listTaskSubsteps,
  deleteTaskStep,
  getTask,
  listTaskSteps,
  updateTaskStep,
  setTaskStepCompleted,
} from "./db/dailyTasks";
import {
  applyFootageBan,
  applyFootageClip,
  applyFootageMove,
  applyFootageSceneBatch,
  applyFootageUsage,
  getFootage,
  listFootageBans,
  previewFootageBan,
  previewFootageClip,
  previewFootageMove,
  previewFootageSceneBatch,
  previewFootageUsage,
  searchFootage,
} from "./db/footage";
import { getCatalogLocation, getCatalogProduct, listCatalogLocations, listCatalogProducts } from "./db/catalog";
import { checkHabit, listHabits } from "./db/habits";
import { attachTaskStepImage } from "./db/stepImages";
import { switchConnectorOrganization } from "./db/connectorSession";
import { accessRevokedAt, recordToolCall, takeToolSlot } from "./db/toolGate";
import { scheduleContentPlan } from "./db/scheduleContentPlan";
import { createApp } from "./http/createApp";
import { SupabaseGrantStore } from "./oauth/supabaseStore";
import { aiEmployeeBriefGet, aiEmployeeBriefUpdate, aiEmployeeChat, aiEmployeeCommand, aiEmployeeQueueList, aiEmployeeReport, aiEmployeeRoutineUpsert, aiEmployeeRoutinesList, aiEmployeeRuns, aiEmployeeScheduleUpdate, aiEmployeeStatus, listAiEmployees } from "./db/aiEmployee";
import { listProductKnowledge } from "./db/productKnowledge";
import { listInboxConversations, listInboxMessages, readInboxSummary } from "./db/inbox";
import { readSocialComments } from "./db/socialComments";
import { readLinkedInPerformance } from "./db/linkedinPerformance";

const config = loadConfig();
const admin = createAdmin(config.supabaseUrl, config.supabaseServiceRoleKey);
const voiceKey = voiceDownloadKey(config.jwtSecret);
const app = createApp({
  config,
  store: new SupabaseGrantStore(admin),
  verifySupabaseUser: (jwt) => verifySupabaseUser(admin, jwt),
  isActiveMember: (userId, organizationId) => isActiveMember(admin, userId, organizationId),
  loadIdentity: (userId, organizationId) => loadConsentIdentity(admin, userId, organizationId),
  loadContext: (claims) => loadContext(admin, claims),
  accessRevokedAt: (claims) => accessRevokedAt(admin, claims),
  takeToolSlot: (ctx) => takeToolSlot(admin, ctx),
  recordToolCall: (ctx, toolName, outcome) => recordToolCall(admin, ctx, toolName, outcome),
  switchOrganization: (ctx, organizationId) => switchConnectorOrganization(admin, ctx.userId, ctx.clientId, organizationId),
  listContentPlans: (ctx) => listContentPlans(admin, ctx),
  listContentCalendar: (ctx, month) => listContentCalendar(admin, ctx, month),
  listContentCatalog: (ctx) => listContentCatalog(admin, ctx),
  listOkrCycles: (ctx) => listOkrCycles(admin, ctx),
  listOkrObjectives: (ctx, cycleId) => listOkrObjectives(admin, ctx, cycleId),
  listOkrDepartments: (ctx) => listOkrDepartments(admin, ctx),
  listCrmLeads: (ctx, status) => listCrmLeads(admin, ctx, status),
  listInboxConversations: (ctx, query) => listInboxConversations(admin, ctx, query),
  listInboxMessages: (ctx, query) => listInboxMessages(admin, ctx, query),
  readInboxSummary: (ctx, query) => readInboxSummary(admin, ctx, query),
  readSocialComments: (ctx, query) => readSocialComments(config, ctx, query),
  readLinkedInPerformance: (ctx, query) => readLinkedInPerformance(config, ctx, query),
  listAdsAccounts: (ctx) => listAdsAccounts(admin, ctx),
  listAdsPerformance: (ctx, query) => listAdsPerformance(config, ctx, query),
  listAdsBreakdown: (ctx, query) => listAdsBreakdown(config, ctx, query),
  listAdsAudience: (ctx, query) => listAdsAudience(config, ctx, query),
  listAdsSegments: (ctx, query) => listAdsSegments(config, ctx, query),
  listIncomeTransactions: (ctx, month) => listIncomeTransactions(admin, ctx, month),
  listExpenses: (ctx, month) => listExpenses(admin, ctx, month),
  listEmployees: (ctx) => listEmployees(admin, ctx),
  listPayrollRuns: (ctx, month) => listPayrollRuns(admin, ctx, month),
  listCustomerVisits: (ctx, month) => listCustomerVisits(admin, ctx, month),
  listPosDailySales: (ctx, month) => listPosDailySales(admin, ctx, month),
  listKolCampaigns: (ctx) => listKolCampaigns(admin, ctx),
  listKolProfiles: (ctx) => listKolProfiles(admin, ctx),
  listInventoryStock: (ctx) => listInventoryStock(admin, ctx),
  listInventorySummary: (ctx, query) => listInventorySummary(admin, ctx, query),
  createRecipeDraft: (ctx, input) => createRecipeDraft(admin, ctx, input),
  listRecipeDrafts: (ctx, status) => listRecipeDrafts(admin, ctx, status),
  listRecipeCosts: (ctx, query) => listRecipeCosts(admin, ctx, query),
  listCatalogSuppliers: (ctx, search) => listCatalogSuppliers(admin, ctx, search),
  previewInventoryPurchaseOrder: (ctx, input) => previewInventoryPurchaseOrder(admin, ctx, input),
  createInventoryPurchaseOrder: (ctx, input, confirmId) => createInventoryPurchaseOrder(admin, ctx, input, confirmId),
  writeInventoryIngredient: (ctx, input, confirmId) => writeCatalogIngredient(admin, ctx, input, confirmId),
  listOpenPurchaseOrders: (ctx, outletId) => listOpenPurchaseOrders(admin, ctx, outletId),
  previewReceivePurchaseOrder: (ctx, input) => previewReceivePurchaseOrder(admin, ctx, input),
  receivePurchaseOrder: (ctx, input, confirmId) => receivePurchaseOrder(admin, ctx, input, confirmId),
  previewStockAdjustment: (ctx, input) => previewStockAdjustment(admin, ctx, input),
  createStockAdjustment: (ctx, input, confirmId) => createStockAdjustment(admin, ctx, input, confirmId),
  previewIngredientProduction: (ctx, input) => previewIngredientProduction(admin, ctx, input),
  createIngredientProduction: (ctx, input, confirmId) => createIngredientProduction(admin, ctx, input, confirmId),
  createContentPlan: (ctx, input) => createContentPlan(admin, ctx, input),
  createContentBrief: (ctx, input) => createContentBrief(admin, ctx, input),
  getContentBrief: (ctx, id) => getContentBrief(admin, ctx, id),
  readContentBriefForUpdate: (ctx, planId) => readContentBriefForUpdate(admin, ctx, planId),
  confirmContentBrief: (ctx, write, confirmId) => confirmContentBrief(admin, ctx, write, confirmId),
  listBriefVoiceClips: (ctx, planId) => listBriefVoiceClips(admin, config.supabaseUrl, ctx, planId),
  getBriefVoiceClip: (ctx, input) =>
    getBriefVoiceClip(admin, ctx, input, { key: voiceKey, publicUrl: config.publicUrl }),
  generateBriefVoiceClip: (ctx, input) => generateBriefVoiceClip(admin, config, ctx, input),
  listLeadMagnetDrafts: (ctx, campaignId) => listLeadMagnetDrafts(admin, ctx, campaignId),
  attachLeadMagnetDelivery: (ctx, input) => attachLeadMagnetDelivery(admin, config.supabaseUrl, ctx, input),
  listThinkingMasters: (ctx) => listThinkingMasters(admin, ctx),
  readThinkingTree: (ctx, masterThoughtId) => readThinkingTree(admin, ctx, masterThoughtId),
  readThinkingDefinitions: (ctx, input) => readThinkingDefinitions(admin, ctx, input),
  createThinkingMaster: (ctx, input) => createThinkingMaster(admin, config, ctx, input),
  addThinkingBigThought: (ctx, input) => addThinkingBigThought(admin, config, ctx, input),
  setThinkingMasterCatalog: (ctx, input) => setThinkingMasterCatalog(admin, ctx, input),
  lockThinkingBigThoughts: (ctx, input) => lockThinkingBigThoughts(admin, ctx, input),
  addThinkingTerritory: (ctx, input) => addThinkingTerritory(admin, config, ctx, input),
  lockThinkingTerritories: (ctx, input) => lockThinkingTerritories(admin, ctx, input),
  addThinkingAngle: (ctx, input) => addThinkingAngle(admin, config, ctx, input),
  lockThinkingAngles: (ctx, input) => lockThinkingAngles(admin, ctx, input),
  addThinkingIdea: (ctx, input) => addThinkingIdea(admin, config, ctx, input),
  lockThinkingIdeas: (ctx, input) => lockThinkingIdeas(admin, ctx, input),
  updateThinkingMaster: (ctx, input) => updateThinkingMaster(admin, config, ctx, input),
  updateThinkingBigThought: (ctx, input) => updateThinkingBigThought(admin, config, ctx, input),
  updateThinkingTerritory: (ctx, input) => updateThinkingTerritory(admin, config, ctx, input),
  updateThinkingAngle: (ctx, input) => updateThinkingAngle(admin, config, ctx, input),
  updateThinkingIdea: (ctx, input) => updateThinkingIdea(admin, config, ctx, input),
  recommendThinkingPillars: (ctx, input) => recommendThinkingPillars(admin, config, ctx, input),
  setThinkingPillar: (ctx, input) => setThinkingPillar(admin, ctx, input),
  removeThinkingPillar: (ctx, input) => removeThinkingPillar(admin, ctx, input),
  listThinkingIdeas: (ctx) => listThinkingIdeas(admin, ctx),
  readThinkingChain: (ctx, ideaId) => readThinkingChain(admin, ctx, ideaId),
  checkThinkingExecution: (ctx, input) => checkThinkingExecution(admin, config, ctx, input),
  saveThinkingPlan: (ctx, input) => saveThinkingPlan(admin, ctx, input),
  saveThinkingPlanDirect: (ctx, input) => saveThinkingPlanDirect(admin, ctx, input),
  updateContentPlan: (ctx, input) => updateContentPlan(admin, ctx, input.id, input),
  setContentPlanDriveLink: (ctx, input) => setContentPlanDriveLink(admin, ctx, input),
  startMediaUpload: (ctx, input) => startMediaUpload(config, ctx, input),
  listMediaVersions: (ctx, planId) => listMediaVersions(admin, ctx, planId),
  putMediaUploadChunk: (ticket, contentRange, body) => putUploadChunk(admin, config, ticket, contentRange, body),
  getMediaUploadStatus: (ticket) => getUploadStatus(admin, ticket),
  downloadVoiceClip: (token) => downloadVoiceClip(admin, voiceKey, token),
  createCompanyObjective: (ctx, input) => createCompanyObjective(admin, ctx, input),
  updateObjective: (ctx, input) => updateObjective(admin, ctx, input),
  createDepartmentObjective: (ctx, input) => createDepartmentObjective(admin, ctx, input),
  createIndividualObjective: (ctx, input) => createIndividualObjective(admin, ctx, input),
  createLead: (ctx, input) => createLead(admin, ctx, input),
  updateLead: (ctx, input) => updateLead(admin, ctx, input),
  scheduleContentPlan: (ctx, id) => scheduleContentPlan(config, ctx, id),
  setLeadStatus: (ctx, input) => setLeadStatus(admin, ctx, input),
  createIncomeTransaction: (ctx, input) => createIncomeTransaction(admin, ctx, input),
  updateIncomeTransaction: (ctx, input) => updateIncomeTransaction(admin, ctx, input),
  createExpenseRecord: (ctx, input) => createExpenseRecord(admin, ctx, input),
  updateExpenseRecord: (ctx, input) => updateExpenseRecord(admin, ctx, input),
  listTaskSummary: (ctx, month) => listTaskSummary(admin, ctx, month),
  listTasks: (ctx, status, month) => listTasks(admin, ctx, status, month),
  listTaskInitiative: (ctx) => listTaskInitiative(admin, ctx),
  listTaskWorkload: (ctx, timeframe) => listTaskWorkload(admin, ctx, timeframe),
  listCompletedSteps: (ctx, month) => listCompletedSteps(admin, ctx, month),
  createTask: (ctx, input) => createTask(admin, ctx, input),
  updateTask: (ctx, input) => updateTask(admin, ctx, input),
  deleteTask: (ctx, id) => deleteTask(admin, ctx, id),
  assignTask: (ctx, input) => assignTask(admin, ctx, input),
  linkTaskObjective: (ctx, input) => linkTaskObjective(admin, ctx, input),
  takeTaskInitiative: (ctx, input) => takeTaskInitiative(admin, ctx, input),
  getTask: (ctx, taskId) => getTask(admin, ctx, taskId),
  searchFootage: (ctx, input) => searchFootage(admin, ctx, input),
  getFootage: (ctx, fileKey) => getFootage(admin, ctx, fileKey),
  listFootageBans: (ctx) => listFootageBans(admin, ctx),
  listCatalogProducts: (ctx) => listCatalogProducts(admin, ctx),
  getCatalogProduct: (ctx, address) => getCatalogProduct(admin, ctx, address),
  listCatalogLocations: (ctx) => listCatalogLocations(admin, ctx),
  getCatalogLocation: (ctx, address) => getCatalogLocation(admin, ctx, address),
  previewFootageSceneBatch: (ctx, input) => previewFootageSceneBatch(admin, ctx, input),
  applyFootageSceneBatch: (ctx, previewId) => applyFootageSceneBatch(admin, ctx, previewId),
  previewFootageUsage: (ctx, input) => previewFootageUsage(admin, ctx, input),
  applyFootageUsage: (ctx, previewId) => applyFootageUsage(admin, ctx, previewId),
  previewFootageMove: (ctx, input) => previewFootageMove(admin, ctx, input),
  applyFootageMove: (ctx, previewId) => applyFootageMove(admin, ctx, previewId),
  previewFootageBan: (ctx, input) => previewFootageBan(admin, ctx, input),
  applyFootageBan: (ctx, previewId) => applyFootageBan(admin, ctx, previewId),
  previewFootageClip: (ctx, input) => previewFootageClip(admin, ctx, input),
  applyFootageClip: (ctx, previewId) => applyFootageClip(admin, ctx, previewId),
  listTaskSteps: (ctx, taskId) => listTaskSteps(admin, ctx, taskId),
  createTaskStep: (ctx, input) => createTaskStep(admin, ctx, input),
  updateTaskStep: (ctx, input) => updateTaskStep(admin, ctx, input),
  setTaskStepCompleted: (ctx, input) => setTaskStepCompleted(admin, ctx, input),
  deleteTaskStep: (ctx, id) => deleteTaskStep(admin, ctx, id),
  listTaskSubsteps: (ctx, stepId) => listTaskSubsteps(admin, ctx, stepId),
  createTaskSubstep: (ctx, input) => createTaskSubstep(admin, ctx, input),
  attachTaskStepImage: (ctx, input) => attachTaskStepImage(admin, config.supabaseUrl, ctx, input),
  listHabits: (ctx, date) => listHabits(admin, ctx, date),
  checkHabit: (ctx, input) => checkHabit(admin, ctx, input),
  listAiEmployees: (ctx) => listAiEmployees(admin, ctx),
  aiEmployeeStatus: (ctx, employeeName) => aiEmployeeStatus(admin, ctx, employeeName),
  aiEmployeeRuns: (ctx, employeeName, limit) => aiEmployeeRuns(admin, ctx, employeeName, limit),
  aiEmployeeReport: (ctx, employeeName, period) => aiEmployeeReport(admin, ctx, employeeName, period),
  aiEmployeeQueueList: (ctx, employeeName) => aiEmployeeQueueList(admin, ctx, employeeName),
  aiEmployeeCommand: (ctx, input) => aiEmployeeCommand(admin, config, ctx, input),
  aiEmployeeChat: (ctx, input) => aiEmployeeChat(admin, config, ctx, input),
  aiEmployeeScheduleUpdate: (ctx, input) => aiEmployeeScheduleUpdate(admin, ctx, input),
  aiEmployeeRoutinesList: (ctx, employeeName) => aiEmployeeRoutinesList(admin, ctx, employeeName),
  aiEmployeeRoutineUpsert: (ctx, input) => aiEmployeeRoutineUpsert(admin, ctx, input),
  aiEmployeeBriefGet: (ctx, employeeName) => aiEmployeeBriefGet(admin, ctx, employeeName),
  aiEmployeeBriefUpdate: (ctx, employeeName, brief) => aiEmployeeBriefUpdate(admin, ctx, employeeName, brief),
  listProductKnowledge: (ctx, input) => listProductKnowledge(admin, ctx, input),
});

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`MCP endpoint ${config.publicUrl}/mcp`);
});
