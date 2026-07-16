import { useMemo } from "react";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { useEffectiveModuleAccess } from "@/shared/auth/hooks/useEffectiveModuleAccess";
import { useSalesModuleAccess } from "@/shared/auth/hooks/useSalesModuleAccess";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";

export type LeadMagnetUpsellKind = "digitalMarketing" | "leadMagnet" | null;

export function useLeadMagnetEntitlement() {
  const {
    isModuleGatingActive,
    isModuleEnabled,
    isLoading: moduleLoading,
    moduleAccessPending,
    gatingMode,
  } = useEffectiveModuleAccess();
  const sales = useSalesModuleAccess();
  const { subscriptionStatus, isLoading: subscriptionLoading } = useOptimizedSubscription({
    includePlans: false,
  });

  const digitalMarketingOk = !isModuleGatingActive || isModuleEnabled("digitalMarketing");

  const mandiriAddonOk = Boolean(subscriptionStatus?.lead_magnet_entitled);
  const salesAddonOk = sales.isSalesTenant && isModuleEnabled("leadMagnet");
  const addonOk = sales.isSalesTenant ? salesAddonOk : mandiriAddonOk;

  const hasEntitlement = digitalMarketingOk && addonOk;

  const upsellKind: LeadMagnetUpsellKind = useMemo(() => {
    if (!digitalMarketingOk) return "digitalMarketing";
    if (!addonOk) return "leadMagnet";
    return null;
  }, [digitalMarketingOk, addonOk]);

  const graceDaysRemaining = useMemo(() => {
    const until = subscriptionStatus?.lead_magnet_grace_until;
    if (!until || subscriptionStatus?.lead_magnet_active) return null;
    const days = differenceInCalendarDays(startOfDay(new Date(until)), startOfDay(new Date()));
    return days >= 0 ? days : null;
  }, [subscriptionStatus?.lead_magnet_grace_until, subscriptionStatus?.lead_magnet_active]);

  const isPending =
    moduleAccessPending ||
    (sales.isSalesTenant ? moduleLoading : moduleLoading || subscriptionLoading);

  return {
    hasEntitlement,
    isPending,
    upsellKind,
    digitalMarketingOk,
    addonOk,
    graceDaysRemaining,
    graceUntil: subscriptionStatus?.lead_magnet_grace_until ?? null,
    isSalesTenant: sales.isSalesTenant,
    gatingMode,
    leadMagnetActive: subscriptionStatus?.lead_magnet_active ?? false,
    billingCycle: subscriptionStatus?.billing_cycle ?? "monthly",
  };
}
