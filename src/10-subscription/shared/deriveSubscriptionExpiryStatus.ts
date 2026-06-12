import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";
import type { SubscriptionExpiryStatus } from "@/10-subscription/hooks/useSubscriptionExpiry";

export function deriveSubscriptionExpiryStatus(
  subscriptionStatus: SubscriptionStatus | null | undefined,
  orgLoading: boolean,
): SubscriptionExpiryStatus {
  if (!subscriptionStatus) {
    return {
      isExpired: false,
      isTrialExpired: false,
      isSubscriptionExpired: false,
      trialEndDate: null,
      subscriptionEndDate: null,
      expiredDate: null,
      daysExpired: 0,
      status: orgLoading ? "checking" : "active",
    };
  }

  const now = new Date();
  const trialEndDate = subscriptionStatus.trial_end_date ? new Date(subscriptionStatus.trial_end_date) : null;
  const subscriptionEndDate = subscriptionStatus.subscription_end_date
    ? new Date(subscriptionStatus.subscription_end_date)
    : null;

  const isTrialExpired = subscriptionStatus.is_trial && trialEndDate ? trialEndDate < now : false;
  const isSubscriptionExpired =
    !subscriptionStatus.is_trial && subscriptionEndDate ? subscriptionEndDate < now : false;
  const isExpired = subscriptionStatus.is_expired || isTrialExpired || isSubscriptionExpired;

  const expiredDate = isTrialExpired
    ? subscriptionStatus.trial_end_date ?? null
    : isSubscriptionExpired
      ? subscriptionStatus.subscription_end_date ?? null
      : null;

  let daysExpired = 0;
  if (expiredDate) {
    const expDate = new Date(expiredDate);
    daysExpired = Math.floor((now.getTime() - expDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    isExpired,
    isTrialExpired,
    isSubscriptionExpired,
    trialEndDate: subscriptionStatus.trial_end_date || null,
    subscriptionEndDate: subscriptionStatus.subscription_end_date || null,
    expiredDate,
    daysExpired,
    status: isExpired ? "expired" : "active",
  };
}
