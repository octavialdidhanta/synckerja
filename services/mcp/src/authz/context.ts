import {
  evaluatePageAccess,
  type PageAccessConfig,
} from "../../../../src/shared/auth/page-access/evaluatePageAccess";
import { buildEffectiveAccessRoles, hasOwnerRole } from "../../../../src/shared/auth/page-access/accessRoleSet";
import type { AccessClaims } from "../oauth/tokens";
import { AuthzError } from "./errors";
import { isModuleEnabled, type ModuleRow } from "./moduleAccess";

export const CONTENT_PAGE_PATH = "/digital-marketing/social-media";
export const CALENDAR_PAGE_PATH = "/digital-marketing/social-media/content-calendar";
export const OKR_PAGE_PATH = "/okr";
export const LEADS_PAGE_PATH = "/omnichannel/leads";
export const GOOGLE_ADS_PAGE_PATH = "/digital-marketing/google-ads";
export const META_ADS_PAGE_PATH = "/digital-marketing/meta-ads";
export const TIKTOK_ADS_PAGE_PATH = "/digital-marketing/tiktok-ads";
export const ADS_PAGE_PATHS = [GOOGLE_ADS_PAGE_PATH, META_ADS_PAGE_PATH, TIKTOK_ADS_PAGE_PATH] as const;
export const INCOME_PAGE_PATH = "/incomes/transaction";
export const EXPENSES_PAGE_PATH = "/expenses/dashboard";
export const EMPLOYEES_PAGE_PATH = "/employees";
export const VISITS_PAGE_PATH = "/operations/sales";
export const KOL_CAMPAIGNS_PAGE_PATH = "/kol-management/campaigns";
export const KOL_PROFILES_PAGE_PATH = "/kol-management/kol-management";
export const INVENTORY_PAGE_PATH = "/operations/inventory";

export const MCP_MODULE_KEYS = [
  "digitalMarketing",
  "okr",
  "omnichannel",
  "finance",
  "humanResources",
  "operations",
] as const;
export type McpModuleKey = (typeof MCP_MODULE_KEYS)[number];

export type McpAuthContext = {
  userId: string;
  profileId: string;
  organizationId: string;
  employeeId: string | null;
  companyName: string;
  roles: string[];
  scopes: string[];
  clientId: string;
  modules: Record<McpModuleKey, boolean>;
  pages: Record<string, boolean>;
};

export function buildAuthContext(input: {
  claims: AccessClaims;
  member: boolean;
  profileId: string | null;
  employeeId: string | null;
  employeeStatus: string | null;
  jobLevelId: string | null;
  jobLevelName: string | null;
  roles: string[];
  companyName: string;
  configurations: PageAccessConfig[];
  subscriptionSelfServiceEnabled: boolean | null | undefined;
  salesRows: ModuleRow[] | null;
  subscriptionPlanId: string | null;
  planRows: ModuleRow[] | null;
}): McpAuthContext {
  if (!input.member) throw new AuthzError("not_a_member", 401);
  if (!input.profileId || input.profileId !== input.claims.profileId) {
    throw new AuthzError("profile_mismatch", 401);
  }
  if (input.claims.employeeId && input.claims.employeeId !== input.employeeId) {
    throw new AuthzError("employee_mismatch", 401);
  }

  const effective = buildEffectiveAccessRoles(input.roles, null);
  const owner = hasOwnerRole(effective, null);
  const status = (input.employeeStatus || "active").toLowerCase();
  if (input.employeeId && (status === "terminated" || status === "inactive") && !owner) {
    throw new AuthzError("terminated", 403);
  }

  const enablement = {
    subscriptionSelfServiceEnabled: input.subscriptionSelfServiceEnabled,
    salesRows: input.salesRows,
    subscriptionPlanId: input.subscriptionPlanId,
    planRows: input.planRows,
  };
  const subject = {
    roles: input.roles,
    primaryRole: null,
    employeeId: input.employeeId,
    jobLevelId: input.jobLevelId,
    jobLevelName: input.jobLevelName,
  };
  const pagePaths = [
    CONTENT_PAGE_PATH,
    CALENDAR_PAGE_PATH,
    OKR_PAGE_PATH,
    LEADS_PAGE_PATH,
    ...ADS_PAGE_PATHS,
    INCOME_PAGE_PATH,
    EXPENSES_PAGE_PATH,
    EMPLOYEES_PAGE_PATH,
    VISITS_PAGE_PATH,
    KOL_CAMPAIGNS_PAGE_PATH,
    KOL_PROFILES_PAGE_PATH,
    INVENTORY_PAGE_PATH,
  ];

  return {
    userId: input.claims.sub,
    profileId: input.profileId,
    organizationId: input.claims.orgId,
    employeeId: input.employeeId,
    companyName: input.companyName,
    roles: input.roles,
    scopes: input.claims.scopes,
    clientId: input.claims.clientId,
    modules: {
      digitalMarketing: isModuleEnabled("digitalMarketing", enablement),
      okr: isModuleEnabled("okr", enablement),
      omnichannel: isModuleEnabled("omnichannel", enablement),
      finance: isModuleEnabled("finance", enablement),
      humanResources: isModuleEnabled("humanResources", enablement),
      operations: isModuleEnabled("operations", enablement),
    },
    pages: Object.fromEntries(
      pagePaths.map((path) => [path, evaluatePageAccess(path, input.configurations, subject, "deny")]),
    ),
  };
}
