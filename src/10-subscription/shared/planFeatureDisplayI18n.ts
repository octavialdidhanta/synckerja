import type { TFunction } from "i18next";
import { CMS_MODULE_LABEL_TO_KEY, type PlanModuleDisplayRow } from "@/10-subscription/shared/planModuleDisplay";
import { SALES_MODULE_DEFINITIONS, type SalesModuleKey } from "@/shared/auth/module-access/moduleCatalog";

/** Add-on modules — shown via add-on panel/sidebar, not in Included Features module list. */
export const PLAN_CARD_ADD_ON_MODULE_KEYS = new Set<SalesModuleKey>(["omnichannel", "leadMagnet"]);

export function formatPlanModuleLine(labelKey: string, t: TFunction): string {
  return t("subscription.plans.features.moduleLine", { name: t(labelKey) });
}

/** Map CMS `features` bullet strings to locale-aware labels (settings language). */
export function translatePlanFeatureBullet(feature: string, t: TFunction): string {
  const trimmed = feature.trim();
  if (!trimmed) return feature;

  if (/^dashboard$/i.test(trimmed) || /^Dashboard\s+selalu\s+aktif$/i.test(trimmed)) {
    return t("subscription.plans.features.dashboard");
  }
  if (/^101\+\s*Member\s*Allowed$/i.test(trimmed)) {
    return t("subscription.plans.features.enterpriseMemberAllowed");
  }
  if (/^Modul\s+kustom$/i.test(trimmed) || /^Custom\s+modules$/i.test(trimmed)) {
    return t("subscription.plans.features.customModules");
  }

  const memberMatch = trimmed.match(/^(\d+)\s*Member\s*Allowed$/i);
  if (memberMatch) {
    return t("subscription.plans.features.memberAllowed", { count: Number(memberMatch[1]) });
  }

  const modulMatch = trimmed.match(/^Modul\s+(.+)$/i);
  if (modulMatch) {
    const key = CMS_MODULE_LABEL_TO_KEY[modulMatch[1].trim()];
    if (key) {
      const def = SALES_MODULE_DEFINITIONS.find((d) => d.key === key);
      if (def) return formatPlanModuleLine(def.labelKey, t);
    }
  }

  return trimmed;
}

export function filterPlanModuleRowsForCard(
  rows: PlanModuleDisplayRow[],
  options?: { excludeAddOnModules?: boolean },
): PlanModuleDisplayRow[] {
  if (!options?.excludeAddOnModules) return rows;
  return rows.filter((row) => !PLAN_CARD_ADD_ON_MODULE_KEYS.has(row.key));
}

const CUSTOM_MODULES_FEATURE_RE = /^Modul\s+kustom$/i;
const CUSTOM_MODULES_FEATURE_EN_RE = /^Custom\s+modules$/i;

/** CMS toggle `customModules` on, or legacy `Modul kustom` in features (shows checkmark). */
export function planHasCustomModulesFeature(plan: {
  features?: unknown;
  plan_module_access?: { customModules?: boolean } | null;
}): boolean {
  if (plan.plan_module_access?.customModules === true) return true;
  if (!Array.isArray(plan.features)) return false;
  return plan.features.some((f) => {
    const trimmed = String(f).trim();
    return CUSTOM_MODULES_FEATURE_RE.test(trimmed) || CUSTOM_MODULES_FEATURE_EN_RE.test(trimmed);
  });
}
