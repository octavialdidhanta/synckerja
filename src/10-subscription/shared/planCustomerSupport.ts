import { isEnterpriseSubscriptionPlan } from "@/10-subscription/shared/subscriptionUtils";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";

export type CustomerSupportLabelKey =
  | "subscription.plans.features.customerSupport.limited"
  | "subscription.plans.features.customerSupport.standard"
  | "subscription.plans.features.customerSupport.247";

export function planHasCustomerSupportFeature(plan: {
  plan_module_access?: { customerSupport?: boolean } | null;
}): boolean {
  return plan.plan_module_access?.customerSupport === true;
}

export function resolvePlanCustomerSupportLabelKey(
  plan: Pick<SubscriptionPlan, "name" | "is_custom" | "base_price_per_member" | "plan_module_access">,
): CustomerSupportLabelKey | null {
  if (!planHasCustomerSupportFeature(plan)) return null;

  if (isEnterpriseSubscriptionPlan(plan)) {
    return "subscription.plans.features.customerSupport.247";
  }

  if (plan.base_price_per_member === 0) {
    return "subscription.plans.features.customerSupport.limited";
  }

  return "subscription.plans.features.customerSupport.standard";
}
