import {
  createDefaultSalesModuleAccess,
  mergeSalesModuleAccess,
  SALES_MODULE_DEFINITIONS,
  type ModuleAccessMap,
  type SalesModuleKey,
} from "@/shared/auth/module-access/moduleCatalog";

/** CMS `_plan_module_label` values — keep in sync with Supabase. */
const CMS_MODULE_LABEL_TO_KEY: Record<string, SalesModuleKey> = {
  OKR: "okr",
  "Human Resources": "humanResources",
  Finance: "finance",
  "Digital Marketing": "digitalMarketing",
  "Operations / Omnichannel": "omnichannel",
  "Sales Operations": "operations",
  Tools: "tools",
  "Request Form": "requestForm",
};

export type PlanModuleDisplayRow = {
  key: SalesModuleKey;
  labelKey: string;
  enabled: boolean;
};

export function isPlanModuleFeatureLine(feature: string): boolean {
  return /^Modul\s+/i.test(feature.trim());
}

export function moduleAccessFromPlanFeatures(features: string[]): ModuleAccessMap {
  const access = createDefaultSalesModuleAccess();
  for (const feature of features) {
    const match = feature.trim().match(/^Modul\s+(.+)$/i);
    if (!match) continue;
    const key = CMS_MODULE_LABEL_TO_KEY[match[1].trim()];
    if (key) access[key] = true;
  }
  return access;
}

export function resolvePlanModuleAccessForDisplay(
  features: string[],
  rows: Array<{ module_key: string; is_enabled: boolean }> | null | undefined,
): ModuleAccessMap {
  if (rows && rows.length > 0) return mergeSalesModuleAccess(rows);
  return moduleAccessFromPlanFeatures(features);
}

export function buildPlanModuleDisplayRows(access: ModuleAccessMap): PlanModuleDisplayRow[] {
  return SALES_MODULE_DEFINITIONS.map((def) => ({
    key: def.key,
    labelKey: def.labelKey,
    enabled: access[def.key] ?? false,
  }));
}
