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
  "whatsappBusiness",
  "pos",
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

const EXCLUDED_NAV_IDS = new Set(["dashboard", "subscription", "aiEmployees"]);

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

function addModulePrefixes(
  buckets: Map<SalesModuleKey, Set<string>>,
  key: string,
  prefixes: string[],
) {
  if (!SALES_MODULE_KEYS.includes(key as SalesModuleKey)) return;
  const moduleKey = key as SalesModuleKey;
  const set = buckets.get(moduleKey) ?? new Set<string>();
  prefixes.forEach((prefix) => {
    if (prefix && prefix !== "/") set.add(prefix);
  });
  buckets.set(moduleKey, set);
}

/** Path prefixes per module. POS and Operations share one sidebar item, so their rows carry salesModuleKey. */
function modulePrefixBuckets(): Map<SalesModuleKey, Set<string>> {
  const buckets = new Map<SalesModuleKey, Set<string>>();

  for (const item of mainNavItems) {
    if (EXCLUDED_NAV_IDS.has(item.id)) continue;
    const split = item.subItems?.some((sub) => sub.salesModuleKey);
    if (!split) {
      addModulePrefixes(buckets, item.id, collectPathPrefixes(item));
      continue;
    }
    for (const sub of item.subItems ?? []) {
      addModulePrefixes(buckets, sub.salesModuleKey ?? item.id, [
        pathBaseFromNavPath(sub.path),
        ...(sub.activePathPrefixes ?? []),
      ]);
    }
  }

  return buckets;
}

const MODULE_PREFIX_BUCKETS = modulePrefixBuckets();

export const SALES_MODULE_DEFINITIONS: SalesModuleDefinition[] = [
  ...mainNavItems
    .filter((item) => !EXCLUDED_NAV_IDS.has(item.id))
    .map((item) => ({
      key: item.id as SalesModuleKey,
      labelKey: item.id === "operations" ? "salesModule.operations.label" : item.titleKey,
      pathPrefixes: [...(MODULE_PREFIX_BUCKETS.get(item.id as SalesModuleKey) ?? [])],
    })),
  {
    key: "pos",
    labelKey: "salesModule.pos.label",
    pathPrefixes: [...(MODULE_PREFIX_BUCKETS.get("pos") ?? [])],
  },
];

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
  const seen = new Set<SalesModuleKey>();
  rows?.forEach((row) => {
    const key = row.module_key as SalesModuleKey;
    if (SALES_MODULE_KEYS.includes(key)) {
      merged[key] = row.is_enabled;
      seen.add(key);
    }
  });
  // Before the POS row exists, the old operations flag covered both products.
  if (!seen.has("pos") && seen.has("operations")) {
    merged.pos = merged.operations;
  }
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

/** Routes included in the sales WhatsApp Business API package. */
const WHATSAPP_BUSINESS_PACKAGE_PREFIXES = [
  "/omnichannel/livechat",
  "/omnichannel/integrations/whatsapp",
  "/omnichannel/integrations/instagram",
  "/omnichannel/integrations/facebook",
  "/omnichannel/integrations/threads",
  "/omnichannel/integrations/email",
  "/omnichannel/campaign/whatsapp",
  "/omnichannel/campaign/templates",
  "/omnichannel/campaign/recipient-lists",
  "/omnichannel/settings/flow-builder",
  "/omnichannel/flow-builder",
  "/omnichannel/settings/user-management",
] as const;

export function isWhatsappBusinessPackagePath(pathname: string): boolean {
  const current = normalizePath(pathname);
  return WHATSAPP_BUSINESS_PACKAGE_PREFIXES.some((prefix) => pathMatchesPrefix(current, prefix));
}

/** Resolve a URL path to a sales-managed module key. Dashboard returns null (always allowed). */
export function resolveSalesModuleForPath(pathname: string): SalesModuleKey | null {
  const current = normalizePath(pathname);
  if (current === "/") return null;
  if (current === "/ai-employees" || current.startsWith("/ai-employees/")) return "humanResources";

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
