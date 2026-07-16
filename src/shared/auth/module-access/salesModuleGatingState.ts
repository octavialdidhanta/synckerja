import {
  createDefaultSalesModuleAccess,
  createFullModuleAccess,
  type ModuleAccessMap,
} from "@/shared/auth/module-access/moduleCatalog";

export type SalesModuleGatingState = {
  isModuleGatingActive: boolean;
  moduleAccess: ModuleAccessMap | null;
  moduleAccessPending: boolean;
};

/** Fail-open while sales module access is still fetching (mirrors usePlanModuleAccess bootstrap). */
export function resolveSalesModuleGatingState(
  isSalesTenant: boolean,
  isLoading: boolean,
  fetchedAccess: ModuleAccessMap | undefined,
): SalesModuleGatingState {
  if (!isSalesTenant) {
    return { isModuleGatingActive: false, moduleAccess: null, moduleAccessPending: false };
  }

  if (isLoading && fetchedAccess === undefined) {
    return {
      isModuleGatingActive: false,
      moduleAccess: createFullModuleAccess(),
      moduleAccessPending: true,
    };
  }

  return {
    isModuleGatingActive: true,
    moduleAccess: fetchedAccess ?? createDefaultSalesModuleAccess(),
    moduleAccessPending: false,
  };
}
