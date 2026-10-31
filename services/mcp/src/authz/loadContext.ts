import type { SupabaseClient } from "@supabase/supabase-js";
import type { PageAccessConfig } from "../../../../src/shared/auth/page-access/evaluatePageAccess";
import type { AccessClaims } from "../oauth/tokens";
import { AuthzError } from "./errors";
import { buildAuthContext, type McpAuthContext } from "./context";
import type { ModuleRow } from "./moduleAccess";

export async function loadContext(admin: SupabaseClient, claims: AccessClaims): Promise<McpAuthContext> {
  const { data: member, error: memberError } = await admin
    .from("user_organizations")
    .select("is_active")
    .eq("user_id", claims.sub)
    .eq("organization_id", claims.orgId)
    .maybeSingle();
  if (memberError) throw new AuthzError("membership_lookup_failed", 401);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", claims.sub)
    .maybeSingle();
  if (profileError) throw new AuthzError("profile_lookup_failed", 401);

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id, employee_status_id, job_level_id")
    .eq("user_id", claims.sub)
    .eq("organization_id", claims.orgId)
    .maybeSingle();
  if (employeeError) throw new AuthzError("employee_lookup_failed", 401);

  let employeeStatus: string | null = null;
  let jobLevelName: string | null = null;
  if (employee?.employee_status_id) {
    const { data: status, error: statusError } = await admin
      .from("employee_statuses")
      .select("name")
      .eq("id", employee.employee_status_id)
      .maybeSingle();
    if (statusError) throw new AuthzError("employee_lookup_failed", 401);
    employeeStatus = status?.name ?? null;
  }
  if (employee?.job_level_id) {
    const { data: level, error: levelError } = await admin
      .from("job_levels")
      .select("name")
      .eq("id", employee.job_level_id)
      .maybeSingle();
    if (levelError) throw new AuthzError("employee_lookup_failed", 401);
    jobLevelName = level?.name ?? null;
  }

  const { data: roleRows, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", claims.sub)
    .eq("organization_id", claims.orgId);
  if (roleError) throw new AuthzError("role_lookup_failed", 401);

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("company_name, subscription_self_service_enabled")
    .eq("id", claims.orgId)
    .maybeSingle();
  if (orgError || !org) throw new AuthzError("organization_lookup_failed", 401);

  const { data: configs, error: configError } = await admin
    .from("permission_configurations")
    .select("page_path, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths")
    .eq("organization_id", claims.orgId);
  if (configError) throw new AuthzError("permission_lookup_failed", 401);

  let salesRows: ModuleRow[] | null = null;
  let subscriptionPlanId: string | null = null;
  let planRows: ModuleRow[] | null = null;
  if (org.subscription_self_service_enabled === false) {
    const { data, error } = await admin
      .from("organization_sales_module_access")
      .select("module_key, is_enabled")
      .eq("organization_id", claims.orgId);
    if (error) throw new AuthzError("module_lookup_failed", 401);
    salesRows = data ?? [];
  } else {
    const { data: sub, error: subError } = await admin
      .from("organization_subscriptions")
      .select("subscription_plan_id")
      .eq("organization_id", claims.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError) throw new AuthzError("module_lookup_failed", 401);
    subscriptionPlanId = sub?.subscription_plan_id ?? null;
    if (subscriptionPlanId) {
      const { data, error } = await admin
        .from("subscription_plan_module_access")
        .select("module_key, is_enabled")
        .eq("subscription_plan_id", subscriptionPlanId);
      if (error) throw new AuthzError("module_lookup_failed", 401);
      planRows = data ?? [];
    }
  }

  return buildAuthContext({
    claims,
    member: Boolean(member) && member?.is_active !== false,
    profileId: profile?.id ?? null,
    employeeId: employee?.id ?? null,
    employeeStatus,
    jobLevelId: employee?.job_level_id ?? null,
    jobLevelName,
    roles: (roleRows ?? []).map((row) => String(row.role)),
    companyName: String(org.company_name ?? ""),
    configurations: (configs ?? []) as PageAccessConfig[],
    subscriptionSelfServiceEnabled: org.subscription_self_service_enabled,
    salesRows,
    subscriptionPlanId,
    planRows,
  });
}
