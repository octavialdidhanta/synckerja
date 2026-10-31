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

export const MCP_MODULE_KEYS = ["digitalMarketing", "okr", "omnichannel"] as const;
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
  const pagePaths = [CONTENT_PAGE_PATH, CALENDAR_PAGE_PATH, OKR_PAGE_PATH, LEADS_PAGE_PATH];

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
    },
    pages: Object.fromEntries(
      pagePaths.map((path) => [path, evaluatePageAccess(path, input.configurations, subject, "deny")]),
    ),
  };
}
