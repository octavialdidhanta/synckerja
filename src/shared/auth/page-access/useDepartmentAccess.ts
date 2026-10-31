import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatAccessLevelLabel } from "@/shared/lib/formatOrganizationRole";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { usePermissionConfiguration } from "./usePermissionConfiguration";
import { logger } from "@/shared/lib/logger";
import {
  accessCache,
  ACCESS_CACHE_TTL,
  clearAccessCache,
  forceClearCache,
} from "./departmentPageAccessCache";
import { buildEffectiveAccessRoles, hasOwnerRole } from "./accessRoleSet";
import {
  evaluatePageAccess,
  normalizePagePath,
  pageAccessConfigsToEvaluate,
} from "./evaluatePageAccess";
import {
  isSubscriptionModulePath,
  isSubscriptionSelfServiceEnabled,
} from "@/10-subscription/shared/subscriptionSelfService";
import { useEffectiveModuleAccess } from "@/shared/auth/hooks/useEffectiveModuleAccess";
import { isSalesModulePathBlocked } from "@/shared/auth/module-access/moduleCatalog";

const CROSS_DEPARTMENT_PAGES = ["/employees", "/reports", "/company", "/organization"];

const isDev = import.meta.env.DEV;

export {
  clearAccessCache,
  debugAccessCache,
  forceClearCache,
} from "./departmentPageAccessCache";

export { hasOwnerRole } from "./accessRoleSet";

export const useDepartmentAccess = () => {
  const { t } = useTranslation();
  const {
    userRole,
    organizationMemberRoles,
    employee,
    userData,
    isOwner,
    isAdmin,
    organization,
    centralProfileHydrated,
  } = useCentralizedUserData();
  const { configurations, loading: configLoading, configBootstrapPending } =
    usePermissionConfiguration();
  const {
    isModuleGatingActive,
    moduleAccess,
    moduleAccessPending,
    getUpsellModuleForPath,
  } = useEffectiveModuleAccess();

  const departmentAccess = useMemo(() => {
    const currentDepartmentId = employee?.department_id;
    const eff = buildEffectiveAccessRoles(organizationMemberRoles, userRole);
    const ownerRole = hasOwnerRole(eff, userRole);

    const configHash = configurations.map((c) => `${c.id}-${c.updated_at}`).join("|");

    const lastConfigHash =
      accessCache.size > 0 ? Array.from(accessCache.values())[0]?.configHash : "";

    if (configHash !== lastConfigHash && configurations.length > 0 && accessCache.size > 0) {
      clearAccessCache();
    }

    const rolesResolutionPending = Boolean(
      userData?.active_organization_id &&
        !!organization &&
        organizationMemberRoles.length === 0 &&
        !userRole &&
        !ownerRole,
    );

    const accessDecisionPending =
      configBootstrapPending ||
      rolesResolutionPending ||
      Boolean(
        userData?.active_organization_id &&
          (!centralProfileHydrated || (!organization && !configLoading)),
      );

    const canAccessPage = (pagePath: string): boolean => {
      const effForPath = buildEffectiveAccessRoles(organizationMemberRoles, userRole);
      const hasOwner = hasOwnerRole(effForPath, userRole);

      if (employee && organization && !hasOwner) {
        const employeeStatus =
          (employee as { status?: string; employee_status_name?: string }).status ||
          (employee as { employee_status_name?: string }).employee_status_name;
        const statusLower = employeeStatus?.toLowerCase();
        const isTerminatedOrInactive = statusLower === "terminated" || statusLower === "inactive";

        if (isTerminatedOrInactive) {
          if (isDev) {
            logger.debug("Access denied: Employee is terminated/inactive", {
              employeeId: employee.id,
              status: employeeStatus,
              pagePath,
            });
          }
          return false;
        }
      }

      const current = normalizePagePath(pagePath);
      if (
        isSubscriptionModulePath(current) &&
        !isSubscriptionSelfServiceEnabled(organization?.subscription_self_service_enabled)
      ) {
        return false;
      }

      if (
        !moduleAccessPending &&
        isSalesModulePathBlocked(current, isModuleGatingActive, moduleAccess)
      ) {
        return false;
      }

      if (hasOwner) {
        return true;
      }

      if (accessDecisionPending) {
        return true;
      }

      if (configLoading) {
        return true;
      }

      if (userData?.active_organization_id && !organization) {
        return true;
      }

      if (userData?.active_organization_id && effForPath.length === 0) {
        return true;
      }

      if (userData && employee && effForPath.length === 0) {
        if (userData.active_organization_id) {
          return true;
        }

        return false;
      }

      const verbosePermissions = import.meta.env.VITE_VERBOSE_PERMISSIONS === "true";

      const cacheKey = `${current}-${effForPath.slice().sort().join("|")}-${employee?.id || "no-emp"}`;
      const cached = accessCache.get(cacheKey);
      if (
        cached &&
        Date.now() - cached.timestamp < ACCESS_CACHE_TTL &&
        cached.configHash === configHash
      ) {
        return cached.result;
      }

      const employeeLevel = employee as
        | (typeof employee & {
            job_level_id?: string | null;
            job_levels?: { id?: string; name?: string } | null;
          })
        | null;

      if (isDev && verbosePermissions) {
        logger.debug(`PERMISSION DEBUG: ${pagePath}`, {
          current,
          userRole,
          eff: effForPath,
          configsToEvaluate: pageAccessConfigsToEvaluate(current, configurations),
        });
      }

      const result = evaluatePageAccess(
        current,
        configurations,
        {
          roles: organizationMemberRoles,
          primaryRole: userRole,
          employeeId: employee?.id ?? null,
          jobLevelId: employeeLevel?.job_level_id || employeeLevel?.job_levels?.id || null,
          jobLevelName: employeeLevel?.job_levels?.name || null,
        },
        "allow",
      );

      accessCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        configHash,
      });

      return result;
    };

    const hasAccessToAnySubPath = (basePath: string, subPaths: string[]): boolean => {
      return subPaths.some((subPath) => canAccessPage(subPath));
    };

    const canAccessDepartment = (targetDepartmentId?: string): boolean => {
      const effDept = buildEffectiveAccessRoles(organizationMemberRoles, userRole);
      if (isOwner || isAdmin || effDept.includes("owner") || effDept.includes("admin")) {
        return true;
      }

      if (effDept.includes("hr")) {
        return true;
      }

      if (effDept.includes("employee") || effDept.includes("manager") || effDept.includes("member")) {
        return !targetDepartmentId || targetDepartmentId === currentDepartmentId;
      }

      return true;
    };

    const requiresCrossDepartmentAccess = (pagePath: string): boolean => {
      return CROSS_DEPARTMENT_PAGES.some((crossDeptPage) => pagePath.startsWith(crossDeptPage));
    };

    const getAccessLevel = (): string =>
      formatAccessLevelLabel(t, userRole, organizationMemberRoles);

    const getDepartmentRestrictionMessage = (): string | null => {
      if (isOwner || isAdmin || userRole === "hr") return null;

      if (userRole === "employee") {
        const deptName =
          employee?.departments?.name || employee?.department?.name || "your department";
        return `You can only access data from ${deptName}`;
      }

      return null;
    };

    return {
      canAccessPage,
      canAccessDepartment,
      hasAccessToAnySubPath,
      requiresCrossDepartmentAccess,
      getAccessLevel,
      getDepartmentRestrictionMessage,
      getSalesModuleUpsellForPath: getUpsellModuleForPath,
      currentDepartmentId,
      userRole,
      isOwner,
      isAdmin,
      departmentName: employee?.departments?.name || employee?.department?.name,
      configLoading,
      configBootstrapPending,
      configHash,
      rolesResolutionPending,
      accessDecisionPending,
      moduleAccessPending,
    };
  }, [
    userRole,
    organizationMemberRoles,
    employee,
    userData,
    isOwner,
    isAdmin,
    organization,
    configurations,
    configLoading,
    configBootstrapPending,
    centralProfileHydrated,
    t,
    isModuleGatingActive,
    moduleAccess,
    moduleAccessPending,
    getUpsellModuleForPath,
  ]);

  const { configHash } = departmentAccess;

  useEffect(() => {
    forceClearCache();
  }, [userRole, organizationMemberRoles, isOwner, isAdmin, organization?.id, configHash]);

  return departmentAccess;
};
