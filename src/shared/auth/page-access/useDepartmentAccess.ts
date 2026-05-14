import { useMemo } from "react";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { usePermissionConfiguration } from "./usePermissionConfiguration";
import { logger } from "@/shared/lib/logger";
import { accessCache, ACCESS_CACHE_TTL, clearAccessCache } from "./departmentPageAccessCache";
import { buildEffectiveAccessRoles } from "./accessRoleSet";

const CROSS_DEPARTMENT_PAGES = ["/employees", "/reports", "/company", "/organization"];

const isDev = import.meta.env.DEV;

const loggedOverridePaths = new Set<string>();

export {
  clearAccessCache,
  debugAccessCache,
  forceClearCache,
} from "./departmentPageAccessCache";

export const useDepartmentAccess = () => {
  const { userRole, organizationMemberRoles, employee, userData, isOwner, isAdmin, organization } =
    useCentralizedUserData();
  const { configurations, loading: configLoading } = usePermissionConfiguration();

  const departmentAccess = useMemo(() => {
    const currentDepartmentId = employee?.department_id;

    const configHash = configurations.map((c) => `${c.id}-${c.updated_at}`).join("|");

    const lastConfigHash =
      accessCache.size > 0 ? Array.from(accessCache.values())[0]?.configHash : "";

    if (configHash !== lastConfigHash && configurations.length > 0 && accessCache.size > 0) {
      clearAccessCache();
    }

    const canAccessPage = (pagePath: string): boolean => {
      const normalizePath = (p?: string) => {
        if (!p) return "/";
        let s = p.trim();
        if (!s.startsWith("/")) s = "/" + s;
        if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
        return s.toLowerCase();
      };

      const eff = buildEffectiveAccessRoles(organizationMemberRoles, userRole);
      const treatsAsOwner = isOwner || userRole === "owner" || eff.includes("owner");
      const treatsAsAdmin = isAdmin || userRole === "admin" || eff.includes("admin");

      if (employee && organization && !treatsAsOwner) {
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

      if (treatsAsOwner) {
        return true;
      }

      if (treatsAsAdmin) {
        return true;
      }

      const normalizedPath = normalizePath(pagePath);
      if (normalizedPath === "/company/files") {
        const allowedRoles = ["owner", "admin", "employee", "hr"];
        if (eff.some((r) => allowedRoles.includes(r))) {
          if (isDev && !loggedOverridePaths.has(pagePath)) {
            loggedOverridePaths.add(pagePath);
            setTimeout(() => {
              loggedOverridePaths.delete(pagePath);
            }, 5 * 60 * 1000);
          }
          const cacheKey = `${normalizedPath}-${eff.slice().sort().join("|")}-${employee?.id || "no-emp"}`;
          accessCache.set(cacheKey, {
            result: true,
            timestamp: Date.now(),
            configHash,
          });
          return true;
        }
      }

      if (configLoading) {
        const np = normalizePath(pagePath);

        if (np === "/company/files") {
          const allowedRoles = ["owner", "admin", "employee", "hr"];
          if (eff.some((r) => allowedRoles.includes(r))) {
            return true;
          }
        }

        return false;
      }

      if (userData && employee && eff.length === 0) {
        const np = normalizePath(pagePath);

        if (np === "/company/files" && employee) {
          return true;
        }

        return false;
      }

      const current = normalizePath(pagePath);

      const verbosePermissions = import.meta.env.VITE_VERBOSE_PERMISSIONS === "true";

      const cacheKey = `${current}-${eff.slice().sort().join("|")}-${employee?.id || "no-emp"}`;
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

      let config: (typeof matchingConfigs)[number] | undefined;
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
        config = pickMostSpecific(exactRoot) || pickMostSpecific(legacyDashboard);
      }
      if (config == null) {
        config = pickMostSpecific(matchingConfigs);
      }

      if (isDev && verbosePermissions) {
        logger.debug(`PERMISSION DEBUG: ${pagePath}`, { current, userRole, eff, config });
      }

      if (!config) {
        const result = false;
        accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
        return result;
      }

      if (config.exception_paths && config.exception_paths.length > 0) {
        const isExceptionPath = config.exception_paths.some((exceptionPath) => {
          const ex = normalizePath(exceptionPath);
          return current === ex || current.startsWith(ex + "/");
        });

        if (isExceptionPath) {
          const result = true;
          accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
          return result;
        }
      }

      if (config.is_active === false) {
        const result = false;
        accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
        return result;
      }

      if (treatsAsOwner || treatsAsAdmin) {
        const result = true;
        accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
        return result;
      }

      if (current === "/company/files") {
        const allowedRoles = ["owner", "admin", "employee", "hr"];
        if (eff.some((r) => allowedRoles.includes(r))) {
          const result = true;
          accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
          return result;
        }
      }

      if (eff.length === 0) {
        const result = false;
        accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
        return result;
      }

      const allowedInConfig = (config.roles_allowed || []).map((r) => (r || "").toLowerCase().trim());
      const hasRoleAccess = eff.some((r) => allowedInConfig.includes(r));

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
      const eff = buildEffectiveAccessRoles(organizationMemberRoles, userRole);
      if (isOwner || isAdmin || eff.includes("owner") || eff.includes("admin")) {
        return true;
      }

      if (eff.includes("hr")) {
        return true;
      }

      if (eff.includes("employee") || eff.includes("manager") || eff.includes("member")) {
        return !targetDepartmentId || targetDepartmentId === currentDepartmentId;
      }

      return true;
    };

    const requiresCrossDepartmentAccess = (pagePath: string): boolean => {
      return CROSS_DEPARTMENT_PAGES.some((crossDeptPage) => pagePath.startsWith(crossDeptPage));
    };

    const getAccessLevel = (): string => {
      if (isOwner) return "Full Access (Owner)";
      if (isAdmin) return "Full Access (Admin)";
      if (userRole === "hr") return "HR Access (Employee Management)";
      if (userRole === "employee") return "Department Access Only";
      return "Limited Access";
    };

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
      configHash,
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
  ]);

  return departmentAccess;
};
