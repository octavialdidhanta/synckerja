import { useMemo } from "react";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { usePermissionConfiguration } from "./usePermissionConfiguration";
import { logger } from "@/shared/lib/logger";
import { accessCache, ACCESS_CACHE_TTL, clearAccessCache } from "./departmentPageAccessCache";

const UNRESTRICTED_DURING_LOADING = [
  "/",
  "/access-permissions/page-access",
  "/access-permissions/overview",
  "/access-permissions/roles",
  "/access-permissions/pages",
  "/access-permissions",
  "/subscription/management",
  "/subscription",
  "/okr",
  "/employees",
  "/employees/add",
  "/employees/reprimand",
  "/my-info",
  "/recruitment",
  "/attendance",
  "/transfer-ownership",
  "/settings",
  "/payroll",
  "/incomes",
];

const CROSS_DEPARTMENT_PAGES = ["/employees", "/reports", "/company", "/organization"];

const isDev = import.meta.env.DEV;

const loggedOverridePaths = new Set<string>();

export {
  clearAccessCache,
  debugAccessCache,
  forceClearCache,
} from "./departmentPageAccessCache";

export const useDepartmentAccess = () => {
  const { userRole, employee, userData, isOwner, isAdmin, organization } =
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
      if (employee && organization && !isOwner) {
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

      if (isOwner || userRole === "owner") {
        return true;
      }

      if (isAdmin || userRole === "admin") {
        return true;
      }

      const normalizePath = (p?: string) => {
        if (!p) return "/";
        let s = p.trim();
        if (!s.startsWith("/")) s = "/" + s;
        if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
        return s.toLowerCase();
      };

      const normalizedPath = normalizePath(pagePath);
      if (normalizedPath === "/company/files") {
        const allowedRoles = ["owner", "admin", "employee", "hr"];
        const normalizedRole = userRole?.toLowerCase().trim();

        if (normalizedRole && allowedRoles.includes(normalizedRole)) {
          if (isDev && !loggedOverridePaths.has(pagePath)) {
            loggedOverridePaths.add(pagePath);
            setTimeout(() => {
              loggedOverridePaths.delete(pagePath);
            }, 5 * 60 * 1000);
          }
          const cacheKey = `${normalizedPath}-${userRole}-${employee?.id || "no-emp"}`;
          accessCache.set(cacheKey, {
            result: true,
            timestamp: Date.now(),
            configHash,
          });
          return true;
        }
      }

      if (configLoading) {
        const normalize = (p?: string) => {
          if (!p) return "/";
          let s = p.trim();
          if (!s.startsWith("/")) s = "/" + s;
          if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
          return s.toLowerCase();
        };

        const np = normalize(pagePath);

        if (np === "/company/files") {
          const allowedRoles = ["owner", "admin", "employee", "hr"];
          const normalizedRole = userRole?.toLowerCase().trim();

          if (normalizedRole && allowedRoles.includes(normalizedRole)) {
            return true;
          }
        }

        const isUnrestrictedDuringLoading = UNRESTRICTED_DURING_LOADING.some((unrestrictedPath) => {
          const normalizedUnrestricted = normalize(unrestrictedPath);
          return (
            np === normalizedUnrestricted || np.startsWith(normalizedUnrestricted + "/")
          );
        });

        if (isUnrestrictedDuringLoading) {
          return true;
        }

        return false;
      }

      if (userData && !userRole && employee) {
        const normalize = (p?: string) => {
          if (!p) return "/";
          let s = p.trim();
          if (!s.startsWith("/")) s = "/" + s;
          if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
          return s.toLowerCase();
        };

        const np = normalize(pagePath);

        if (np === "/company/files" && employee) {
          return true;
        }

        const isUnrestrictedDuringLoading = UNRESTRICTED_DURING_LOADING.some((unrestrictedPath) => {
          const normalizedUnrestricted = normalize(unrestrictedPath);
          return (
            np === normalizedUnrestricted || np.startsWith(normalizedUnrestricted + "/")
          );
        });

        if (isUnrestrictedDuringLoading) {
          return true;
        }

        return false;
      }

      const normalize = (p?: string) => {
        if (!p) return "/";
        let s = p.trim();
        if (!s.startsWith("/")) s = "/" + s;
        if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
        return s.toLowerCase();
      };

      const current = normalize(pagePath);

      const verbosePermissions = import.meta.env.VITE_VERBOSE_PERMISSIONS === "true";

      const cacheKey = `${current}-${userRole}-${employee?.id || "no-emp"}`;
      const cached = accessCache.get(cacheKey);
      if (
        cached &&
        Date.now() - cached.timestamp < ACCESS_CACHE_TTL &&
        cached.configHash === configHash
      ) {
        return cached.result;
      }

      const matchingConfigs = configurations.filter((c) => {
        const base = normalize(c.page_path);
        return current === base || current.startsWith(base + "/");
      });

      const orgSpecificConfig = matchingConfigs.find((c) => c.organization_id !== null);
      const systemWideConfig = matchingConfigs.find((c) => c.organization_id === null);
      const config = orgSpecificConfig || systemWideConfig;

      if (isDev && verbosePermissions) {
        logger.debug(`PERMISSION DEBUG: ${pagePath}`, { current, userRole, config });
      }

      if (!config) {
        const result = true;
        accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
        return result;
      }

      if (config.exception_paths && config.exception_paths.length > 0) {
        const isExceptionPath = config.exception_paths.some((exceptionPath) => {
          const ex = normalize(exceptionPath);
          return current === ex || current.startsWith(ex + "/");
        });

        if (isExceptionPath) {
          const result = true;
          accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
          return result;
        }
      }

      const isOwnerByRole =
        (userRole as string) === "owner" ||
        (userRole as string) === "admin" ||
        isAdmin === true;
      const isOwnerByFlag = isOwner === true;
      const isDefinitelyOwner = isOwnerByRole || isOwnerByFlag;

      if (isDefinitelyOwner) {
        const result = true;
        accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
        return result;
      }

      if (current === "/company/files") {
        const allowedRoles = ["owner", "admin", "employee", "hr"];
        const normalizedRole = userRole?.toLowerCase().trim();

        if (normalizedRole && allowedRoles.includes(normalizedRole)) {
          const result = true;
          accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
          return result;
        }
      }

      if (!userRole) {
        const result = false;
        accessCache.set(cacheKey, { result, timestamp: Date.now(), configHash });
        return result;
      }

      const hasRoleAccess = (config.roles_allowed || []).includes(userRole);

      const isException =
        !!employee?.id && (config.exceptions || []).includes(employee.id);

      const finalResult = hasRoleAccess || isException;

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
      if (isOwner || isAdmin) {
        return true;
      }

      if (userRole === "hr") {
        return true;
      }

      if (userRole === "employee") {
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
  }, [userRole, employee, userData, isOwner, isAdmin, configurations, configLoading]);

  return departmentAccess;
};
