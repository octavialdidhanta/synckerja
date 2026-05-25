import { describe, expect, it } from "vitest";

type TestConfig = {
  page_path: string;
  roles_allowed: string[];
  is_active?: boolean;
};

const normalizePath = (p: string) => {
  let s = p.trim();
  if (!s.startsWith("/")) s = `/${s}`;
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s.toLowerCase();
};

const configMatchesPath = (configBase: string, path: string) =>
  path === configBase || path.startsWith(`${configBase}/`);

/** Mirrors hierarchical evaluation in useDepartmentAccess.canAccessPage */
function evaluateHierarchyAccess(
  pagePath: string,
  configurations: TestConfig[],
  effectiveRoles: string[],
): boolean {
  const current = normalizePath(pagePath);
  const matchingConfigs = configurations
    .filter((c) => configMatchesPath(normalizePath(c.page_path), current))
    .sort((a, b) => normalizePath(b.page_path).length - normalizePath(a.page_path).length);

  if (matchingConfigs.length === 0) return true;

  const configAllowsUser = (config: TestConfig): boolean => {
    if (config.is_active === false) return false;
    const allowed = (config.roles_allowed || []).map((r) => (r || "").toLowerCase().trim());
    return effectiveRoles.some((r) => allowed.includes(r.toLowerCase().trim()));
  };

  return matchingConfigs.every(configAllowsUser);
}

describe("hierarchical page access (ancestor configs)", () => {
  it("denies child path when parent /omnichannel denies even if settings allows", () => {
    const configs: TestConfig[] = [
      { page_path: "/omnichannel", roles_allowed: [] },
      { page_path: "/omnichannel/settings", roles_allowed: ["employee"] },
    ];
    expect(evaluateHierarchyAccess("/omnichannel/settings", configs, ["employee"])).toBe(false);
  });

  it("allows child when all matching ancestors allow", () => {
    const configs: TestConfig[] = [
      { page_path: "/omnichannel", roles_allowed: ["employee"] },
      { page_path: "/omnichannel/settings", roles_allowed: ["employee"] },
    ];
    expect(evaluateHierarchyAccess("/omnichannel/settings", configs, ["employee"])).toBe(true);
  });

  it("allows unconfigured paths", () => {
    expect(evaluateHierarchyAccess("/tools/calculator", [], ["employee"])).toBe(true);
  });
});
