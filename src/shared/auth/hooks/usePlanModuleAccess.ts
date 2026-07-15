import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  createFullModuleAccess,
  isSalesModulePathBlocked,
  mergeSalesModuleAccess,
  resolveSalesModuleForPath,
  salesModuleDefinition,
  type ModuleAccessMap,
  type SalesModuleKey,
} from "@/shared/auth/module-access/moduleCatalog";
import { isSubscriptionSelfServiceEnabled } from "@/10-subscription/shared/subscriptionSelfService";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";
import { logger } from "@/shared/lib/logger";

export type PlanModuleAccessFetchResult = {
  subscriptionPlanId: string | null;
  enforcementActive: boolean;
  access: ModuleAccessMap;
};

async function fetchPlanModuleAccess(organizationId: string): Promise<PlanModuleAccessFetchResult> {
  const { data: sub, error: subError } = await supabase
    .from("organization_subscriptions")
    .select("subscription_plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (subError) throw subError;

  const subscriptionPlanId = sub?.subscription_plan_id ?? null;
  if (!subscriptionPlanId) {
    return {
      subscriptionPlanId: null,
      enforcementActive: false,
      access: createFullModuleAccess(),
    };
  }

  const { data: rows, error: modError } = await supabase
    .from("subscription_plan_module_access")
    .select("module_key, is_enabled")
    .eq("subscription_plan_id", subscriptionPlanId);

  if (modError) throw modError;

  if (!rows || rows.length === 0) {
    return {
      subscriptionPlanId,
      enforcementActive: false,
      access: createFullModuleAccess(),
    };
  }

  return {
    subscriptionPlanId,
    enforcementActive: true,
    access: mergeSalesModuleAccess(rows),
  };
}

export function usePlanModuleAccess() {
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id;
  const isMandiriTenant = isSubscriptionSelfServiceEnabled(
    organization?.subscription_self_service_enabled,
  );

  const {
    data: fetchResult,
    isLoading,
    isError,
  } = useQuery({
    queryKey: organizationId
      ? subscriptionQueryKeys.planModuleAccessOrgPrefix(organizationId)
      : ["plan-module-access", "none"],
    queryFn: () => fetchPlanModuleAccess(organizationId!),
    enabled: isMandiriTenant && !!organizationId,
    staleTime: 60_000,
  });

  const { enforcementActive, moduleAccess, subscriptionPlanId } = useMemo(() => {
    if (!isMandiriTenant) {
      return {
        enforcementActive: false,
        moduleAccess: null as ModuleAccessMap | null,
        subscriptionPlanId: null as string | null,
      };
    }

    if (isLoading) {
      return {
        enforcementActive: false,
        moduleAccess: createFullModuleAccess(),
        subscriptionPlanId: null,
      };
    }

    if (isError || !fetchResult) {
      if (isError && import.meta.env.DEV) {
        logger.warn("usePlanModuleAccess: fetch failed, fail-open", { organizationId });
      }
      return {
        enforcementActive: false,
        moduleAccess: createFullModuleAccess(),
        subscriptionPlanId: null,
      };
    }

    return {
      enforcementActive: fetchResult.enforcementActive,
      moduleAccess: fetchResult.access,
      subscriptionPlanId: fetchResult.subscriptionPlanId,
    };
  }, [isMandiriTenant, isLoading, isError, fetchResult, organizationId]);

  const isModuleEnabled = (moduleKey: SalesModuleKey): boolean => {
    if (!isMandiriTenant || !enforcementActive || !moduleAccess) return true;
    return moduleAccess[moduleKey] ?? false;
  };

  const isPathBlocked = (pathname: string): boolean =>
    isSalesModulePathBlocked(pathname, enforcementActive, moduleAccess);

  const getUpsellModuleForPath = (pathname: string): SalesModuleKey | null => {
    if (!isPathBlocked(pathname)) return null;
    return resolveSalesModuleForPath(pathname);
  };

  const getUpsellModuleLabelKey = (moduleKey: SalesModuleKey): string =>
    salesModuleDefinition(moduleKey)?.labelKey ?? moduleKey;

  return {
    isMandiriTenant,
    enforcementActive,
    subscriptionPlanId,
    moduleAccess,
    isLoading: isMandiriTenant && isLoading,
    isModuleEnabled,
    isPathBlocked,
    getUpsellModuleForPath,
    getUpsellModuleLabelKey,
    resolveSalesModuleForPath,
  };
}
