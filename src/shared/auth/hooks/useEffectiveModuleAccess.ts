import { useSalesModuleAccess } from "@/shared/auth/hooks/useSalesModuleAccess";
import { usePlanModuleAccess } from "@/shared/auth/hooks/usePlanModuleAccess";
import type { ModuleAccessMap, SalesModuleKey } from "@/shared/auth/module-access/moduleCatalog";
import { resolveSalesModuleForPath, salesModuleDefinition } from "@/shared/auth/module-access/moduleCatalog";

export type ModuleGatingMode = "sales" | "plan" | "none";

export type EffectiveModuleAccess = {
  gatingMode: ModuleGatingMode;
  isModuleGatingActive: boolean;
  moduleAccess: ModuleAccessMap | null;
  isLoading: boolean;
  moduleAccessPending: boolean;
  isModuleEnabled: (moduleKey: SalesModuleKey) => boolean;
  isPathBlocked: (pathname: string) => boolean;
  getUpsellModuleForPath: (pathname: string) => SalesModuleKey | null;
  getUpsellModuleLabelKey: (moduleKey: SalesModuleKey) => string;
  resolveSalesModuleForPath: typeof resolveSalesModuleForPath;
};

export function useEffectiveModuleAccess(): EffectiveModuleAccess {
  const sales = useSalesModuleAccess();
  const plan = usePlanModuleAccess();

  if (sales.isSalesTenant) {
    return {
      gatingMode: "sales",
      isModuleGatingActive: sales.isModuleGatingActive,
      moduleAccess: sales.moduleAccess,
      isLoading: sales.isLoading,
      moduleAccessPending: sales.moduleAccessPending,
      isModuleEnabled: sales.isModuleEnabled,
      isPathBlocked: sales.isPathBlocked,
      getUpsellModuleForPath: sales.getUpsellModuleForPath,
      getUpsellModuleLabelKey: sales.getUpsellModuleLabelKey,
      resolveSalesModuleForPath: sales.resolveSalesModuleForPath,
    };
  }

  if (plan.enforcementActive) {
    return {
      gatingMode: "plan",
      isModuleGatingActive: true,
      moduleAccess: plan.moduleAccess,
      isLoading: plan.isLoading,
      moduleAccessPending: plan.isLoading,
      isModuleEnabled: plan.isModuleEnabled,
      isPathBlocked: plan.isPathBlocked,
      getUpsellModuleForPath: plan.getUpsellModuleForPath,
      getUpsellModuleLabelKey: plan.getUpsellModuleLabelKey,
      resolveSalesModuleForPath: plan.resolveSalesModuleForPath,
    };
  }

  return {
    gatingMode: "none",
    isModuleGatingActive: false,
    moduleAccess: null,
    isLoading: plan.isLoading,
    moduleAccessPending: false,
    isModuleEnabled: () => true,
    isPathBlocked: () => false,
    getUpsellModuleForPath: () => null,
    getUpsellModuleLabelKey: (moduleKey) =>
      salesModuleDefinition(moduleKey)?.labelKey ?? moduleKey,
    resolveSalesModuleForPath,
  };
}
