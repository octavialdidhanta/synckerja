import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  isSalesModulePathBlocked,
  mergeSalesModuleAccess,
  resolveSalesModuleForPath,
  salesModuleDefinition,
  type SalesModuleKey,
} from "@/shared/auth/module-access/moduleCatalog";
import { resolveSalesModuleGatingState } from "@/shared/auth/module-access/salesModuleGatingState";
import { isSubscriptionSelfServiceEnabled } from "@/10-subscription/shared/subscriptionSelfService";

async function fetchSalesModuleAccess(organizationId: string) {
  const { data, error } = await supabase
    .from("organization_sales_module_access")
    .select("module_key, is_enabled")
    .eq("organization_id", organizationId);

  if (error) throw error;
  return mergeSalesModuleAccess(data ?? []);
}

export function useSalesModuleAccess() {
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id;
  const isSalesTenant = !isSubscriptionSelfServiceEnabled(
    organization?.subscription_self_service_enabled,
  );

  const { data: moduleAccess, isLoading } = useQuery({
    queryKey: ["sales-module-access", organizationId],
    queryFn: () => fetchSalesModuleAccess(organizationId!),
    enabled: isSalesTenant && !!organizationId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const { isModuleGatingActive, moduleAccess: access, moduleAccessPending } = useMemo(
    () => resolveSalesModuleGatingState(isSalesTenant, isLoading, moduleAccess),
    [isSalesTenant, isLoading, moduleAccess],
  );

  const isModuleEnabled = (moduleKey: SalesModuleKey): boolean => {
    if (!isModuleGatingActive || !access) return true;
    return access[moduleKey] ?? false;
  };

  const isPathBlocked = (pathname: string): boolean =>
    isSalesModulePathBlocked(pathname, isModuleGatingActive, access);

  const getUpsellModuleForPath = (pathname: string): SalesModuleKey | null => {
    if (!isPathBlocked(pathname)) return null;
    return resolveSalesModuleForPath(pathname);
  };

  const getUpsellModuleLabelKey = (moduleKey: SalesModuleKey): string =>
    salesModuleDefinition(moduleKey)?.labelKey ?? moduleKey;

  return {
    isSalesTenant,
    isModuleGatingActive,
    moduleAccess: access,
    moduleAccessPending,
    isLoading: moduleAccessPending,
    isModuleEnabled,
    isPathBlocked,
    getUpsellModuleForPath,
    getUpsellModuleLabelKey,
    resolveSalesModuleForPath,
  };
}
