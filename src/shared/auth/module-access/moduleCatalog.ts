import {
  mainNavItems,
  pathBaseFromNavPath,
  type MainNavItem,
} from "@/shared/layouts/sidebar/navConfig";

/** Module keys managed for sales tenants — sync with public.sales_module_catalog_keys(). */
export const SALES_MODULE_KEYS = [
  "okr",
  "humanResources",
  "finance",
  "digitalMarketing",
  "leadMagnet",
  "omnichannel",
  "operations",
  "tools",
  "requestForm",
  "customModules",
  "customerSupport",
] as const;

/** Plan-card flags — stored in plan_module_access, not routed in office nav. */
export const SALES_PLAN_FEATURE_KEYS = ["customModules", "customerSupport"] as const;

export type SalesPlanFeatureKey = (typeof SALES_PLAN_FEATURE_KEYS)[number];

export type SalesModuleKey = (typeof SALES_MODULE_KEYS)[number];

/** Module enablement map — shared by sales org access and mandiri plan access. */
export type ModuleAccessMap = Record<SalesModuleKey, boolean>;

export type SalesModuleDefinition = {
  key: SalesModuleKey;
  labelKey: string;
  pathPrefixes: string[];
};

const EXCLUDED_NAV_IDS = new Set(["dashboard", "subscription"]);

function collectPathPrefixes(item: MainNavItem): string[] {
  const prefixes = new Set<string>();

  if (item.path && item.path !== "#") {
    prefixes.add(pathBaseFromNavPath(item.path));
  }
  if (item.activePathPrefix) {
    prefixes.add(item.activePathPrefix);
  }
  item.activePathPrefixes?.forEach((prefix) => prefixes.add(prefix));
  item.subItems?.forEach((sub) => {
    prefixes.add(pathBaseFromNavPath(sub.path));
    sub.activePathPrefixes?.forEach((prefix) => prefixes.add(prefix));
  });

  return [...prefixes].filter((p) => p && p !== "/");
}

export const SALES_MODULE_DEFINITIONS: SalesModuleDefinition[] = mainNavItems
  .filter((item) => !EXCLUDED_NAV_IDS.has(item.id))
  .map((item) => ({
    key: item.id as SalesModuleKey,
    labelKey: item.titleKey,
    pathPrefixes: collectPathPrefixes(item),
  }));

export function createDefaultSalesModuleAccess(): ModuleAccessMap {
  return SALES_MODULE_KEYS.reduce(
    (acc, key) => {
      acc[key] = false;
      return acc;
    },
    {} as ModuleAccessMap,
  );
}

/** Fail-open map for mandiri tenants without a configured plan (legacy / bootstrap). */
export function createFullModuleAccess(): ModuleAccessMap {
  return SALES_MODULE_KEYS.reduce(
    (acc, key) => {
      acc[key] = true;
      return acc;
    },
    {} as ModuleAccessMap,
  );
}

export function mergeSalesModuleAccess(
  rows: Array<{ module_key: string; is_enabled: boolean }> | null | undefined,
): ModuleAccessMap {
  const merged = createDefaultSalesModuleAccess();
  rows?.forEach((row) => {
    const key = row.module_key as SalesModuleKey;
    if (SALES_MODULE_KEYS.includes(key)) {
      merged[key] = row.is_enabled;
    }
  });
  return merged;
}

function normalizePath(pathname: string): string {
  let path = pathname.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path.toLowerCase();
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  const base = normalizePath(prefix);
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Resolve a URL path to a sales-managed module key. Dashboard returns null (always allowed). */
export function resolveSalesModuleForPath(pathname: string): SalesModuleKey | null {
  const current = normalizePath(pathname);
  if (current === "/") return null;

  let best: { key: SalesModuleKey; length: number } | null = null;

  for (const mod of SALES_MODULE_DEFINITIONS) {
    for (const prefix of mod.pathPrefixes) {
      if (!pathMatchesPrefix(current, prefix)) continue;
      const len = normalizePath(prefix).length;
      if (!best || len > best.length) {
        best = { key: mod.key, length: len };
      }
    }
  }

  return best?.key ?? null;
}

export function isSalesModulePathBlocked(
  pathname: string,
  isModuleGatedTenant: boolean,
  moduleAccess: ModuleAccessMap | null | undefined,
): boolean {
  if (!isModuleGatedTenant || !moduleAccess) return false;
  const moduleKey = resolveSalesModuleForPath(pathname);
  if (!moduleKey) return false;
  return !moduleAccess[moduleKey];
}

export function salesModuleDefinition(key: SalesModuleKey): SalesModuleDefinition | undefined {
  return SALES_MODULE_DEFINITIONS.find((mod) => mod.key === key);
}
