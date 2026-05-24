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
      const normalizePath = (p?: string) => {
        if (!p) return "/";
        let s = p.trim();
        if (!s.startsWith("/")) s = "/" + s;
        if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
        return s.toLowerCase();
      };

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

      const current = normalizePath(pagePath);

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

      const configMatchesPath = (configBase: string, path: string) =>
        path === configBase || path.startsWith(`${configBase}/`);

      const matchingConfigs = configurations
        .filter((c) => {
          const base = normalizePath(c.page_path);
          if (configMatchesPath(base, current)) return true;
          if (current === "/" && base === "/dashboard") return true;
          return false;
        })
        .sort(
          (a, b) => normalizePath(b.page_path).length - normalizePath(a.page_path).length,
        );

      const pickMostSpecific = (list: typeof matchingConfigs) => list[0];

      let configsToEvaluate: typeof matchingConfigs;
      if (current === "/") {
        const homeMatches = matchingConfigs
          .filter((c) => {
            const b = normalizePath(c.page_path);
            return b === "/" || b === "/dashboard";
          })
          .sort(
            (a, b) => normalizePath(b.page_path).length - normalizePath(a.page_path).length,
          );
        const exactRoot = homeMatches.filter((c) => normalizePath(c.page_path) === "/");
        const legacyDashboard = homeMatches.filter(
          (c) => normalizePath(c.page_path) === "/dashboard",
        );
        const homeConfig = pickMostSpecific(exactRoot) || pickMostSpecific(legacyDashboard);
        configsToEvaluate = homeConfig ? [homeConfig] : [];
      } else {
        configsToEvaluate = matchingConfigs;
      }

      if (isDev && verbosePermissions) {
        logger.debug(`PERMISSION DEBUG: ${pagePath}`, {
          current,
          userRole,
          eff: effForPath,
          configsToEvaluate,
        });
      }

      // No row in Page Access matrix → do not lock/deny (only configured paths are restricted).
      if (configsToEvaluate.length === 0) {
        const result = true;
        accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
        return result;
      }

      const isExceptionPathForConfig = (cfg: (typeof matchingConfigs)[number]) =>
        (cfg.exception_paths ?? []).some((exceptionPath) => {
          const ex = normalizePath(exceptionPath);
          return current === ex || current.startsWith(`${ex}/`);
        });

      if (configsToEvaluate.some(isExceptionPathForConfig)) {
        const result = true;
        accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
        return result;
      }

      if (hasOwnerRole(effForPath, userRole)) {
        const result = true;
        accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
        return result;
      }

      const configAllowsUser = (config: (typeof matchingConfigs)[number]): boolean => {
        if (config.is_active === false) return false;

        if (effForPath.length === 0) return false;

        const allowedInConfig = (config.roles_allowed || []).map((r) => (r || "").toLowerCase().trim());
        const hasRoleAccess = effForPath.some((r) => allowedInConfig.includes(r));

        const isException =
          !!employee?.id && (config.exceptions || []).includes(employee.id);

        let finalResult = hasRoleAccess || isException;

        const allowedJobLevels = (config.job_levels_allowed || [])
          .map((l) => (l || "").toLowerCase().trim())
          .filter(Boolean);
        if (finalResult && allowedJobLevels.length > 0 && !isException) {
          const emp = employee as
            | (typeof employee & {
                job_level_id?: string | null;
                job_levels?: { id?: string; name?: string } | null;
              })
            | null;
          const levelId = (emp?.job_level_id || emp?.job_levels?.id || "").toLowerCase();
          const levelName = (emp?.job_levels?.name || "").toLowerCase();
          const levelMatches = allowedJobLevels.some(
            (token) =>
              (levelId && token === levelId) || (levelName && token === levelName),
          );
          finalResult = levelMatches;
        }

        return finalResult;
      };

      // Hierarchical paths: every matching ancestor must allow (e.g. `/omnichannel` off blocks `/omnichannel/settings/...`).
      const finalResult = configsToEvaluate.every(configAllowsUser);

      accessCache.set(cacheKey, {
        result: finalResult,
        timestamp: Date.now(),
        configHash,
      });

      return finalResult;
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
  ]);

  const { configHash } = departmentAccess;

  useEffect(() => {
    forceClearCache();
  }, [userRole, organizationMemberRoles, isOwner, isAdmin, organization?.id, configHash]);

  return departmentAccess;
};
