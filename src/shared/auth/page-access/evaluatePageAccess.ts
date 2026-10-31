import { buildEffectiveAccessRoles, hasOwnerRole } from "./accessRoleSet";

export type PageAccessConfig = {
  page_path: string;
  is_active?: boolean | null;
  roles_allowed?: string[] | null;
  job_levels_allowed?: string[] | null;
  exceptions?: string[] | null;
  exception_paths?: string[] | null;
};

export type PageAccessSubject = {
  roles?: string[] | null;
  primaryRole?: string | null;
  employeeId?: string | null;
  jobLevelId?: string | null;
  jobLevelName?: string | null;
};

/** UI keeps unconfigured paths open. The MCP gateway denies them. */
export type MissingConfigPolicy = "allow" | "deny";

export function normalizePagePath(p?: string | null): string {
  if (!p) return "/";
  let s = p.trim();
  if (!s.startsWith("/")) s = `/${s}`;
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s.toLowerCase();
}

function configMatchesPath(configBase: string, path: string): boolean {
  return path === configBase || path.startsWith(`${configBase}/`);
}

/** Config rows that the matrix evaluates for this path, longest prefix first. Home uses one row. */
export function pageAccessConfigsToEvaluate(
  pagePath: string,
  configurations: PageAccessConfig[],
): PageAccessConfig[] {
  const currentPath = normalizePagePath(pagePath);
  const matchingConfigs = configurations
    .filter((config) => {
      const base = normalizePagePath(config.page_path);
      if (configMatchesPath(base, currentPath)) return true;
      if (currentPath === "/" && base === "/dashboard") return true;
      return false;
    })
    .sort((a, b) => normalizePagePath(b.page_path).length - normalizePagePath(a.page_path).length);

  if (currentPath !== "/") return matchingConfigs;

  const homeMatches = matchingConfigs.filter((config) => {
    const base = normalizePagePath(config.page_path);
    return base === "/" || base === "/dashboard";
  });
  const exactRoot = homeMatches.filter((config) => normalizePagePath(config.page_path) === "/");
  const legacyDashboard = homeMatches.filter(
    (config) => normalizePagePath(config.page_path) === "/dashboard",
  );
  const homeConfig = exactRoot[0] || legacyDashboard[0];
  return homeConfig ? [homeConfig] : [];
}

function configAllowsUser(
  config: PageAccessConfig,
  effectiveRoles: string[],
  subject: PageAccessSubject,
): boolean {
  if (config.is_active === false) return false;
  if (effectiveRoles.length === 0) return false;

  const allowedInConfig = (config.roles_allowed || []).map((role) => (role || "").toLowerCase().trim());
  const hasRoleAccess = effectiveRoles.some((role) => allowedInConfig.includes(role));
  const isException = !!subject.employeeId && (config.exceptions || []).includes(subject.employeeId);
  let allowed = hasRoleAccess || isException;

  const allowedJobLevels = (config.job_levels_allowed || [])
    .map((level) => (level || "").toLowerCase().trim())
    .filter(Boolean);
  if (allowed && allowedJobLevels.length > 0 && !isException) {
    const levelId = (subject.jobLevelId || "").toLowerCase();
    const levelName = (subject.jobLevelName || "").toLowerCase();
    allowed = allowedJobLevels.some(
      (token) => (levelId && token === levelId) || (levelName && token === levelName),
    );
  }

  return allowed;
}

export function evaluatePageAccess(
  pagePath: string,
  configurations: PageAccessConfig[],
  subject: PageAccessSubject,
  missingConfig: MissingConfigPolicy,
): boolean {
  const currentPath = normalizePagePath(pagePath);
  const effectiveRoles = buildEffectiveAccessRoles(subject.roles ?? undefined, subject.primaryRole);
  const configsToEvaluate = pageAccessConfigsToEvaluate(currentPath, configurations);

  if (configsToEvaluate.length === 0) {
    return missingConfig === "allow";
  }

  const exceptionPath = configsToEvaluate.some((config) =>
    (config.exception_paths ?? []).some((exceptionPath) => {
      const normalized = normalizePagePath(exceptionPath);
      return currentPath === normalized || currentPath.startsWith(`${normalized}/`);
    }),
  );
  if (exceptionPath) return true;

  if (hasOwnerRole(effectiveRoles, subject.primaryRole)) return true;

  return configsToEvaluate.every((config) => configAllowsUser(config, effectiveRoles, subject));
}
