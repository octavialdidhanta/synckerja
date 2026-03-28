import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { SubscriptionPlanRow } from "@/0-onboarding/types/subscriptionPlan";
import { classifyOnboardingPlan } from "@/0-onboarding/utils/subscriptionPlanUtils";

export type CreateOnboardingSubscriptionInput = {
  organizationId: string;
  plan: SubscriptionPlanRow;
  memberCount: number;
  billingCycle: "monthly" | "yearly";
};

/**
 * Inserts the first `organization_subscriptions` row during onboarding.
 * Post-payment flows should set `last_payment_id` (FK to `payments`) via billing / Midtrans callback.
 */
async function insertOnboardingSubscription(input: CreateOnboardingSubscriptionInput): Promise<void> {
  const { organizationId, plan, memberCount, billingCycle } = input;
  const kind = classifyOnboardingPlan(plan);
  const seats = Math.max(1, Math.floor(memberCount));

  if (kind === "paid_requires_billing") {
    throw new Error("ONBOARDING_PAID_REQUIRES_BILLING");
  }

  if (kind === "scheduled_trial") {
    const trialDays = plan.jumlah_hari_trial ?? 14;
    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setUTCDate(trialEnd.getUTCDate() + trialDays);

    const { error } = await supabase.from("organization_subscriptions").insert({
      organization_id: organizationId,
      subscription_plan_id: plan.id,
      subscription_type: plan.name,
      status: "trial",
      member_count: seats,
      billing_cycle: billingCycle,
      is_trial: true,
      auto_renew: true,
      current_member: 0,
      trial_start_date: trialStart.toISOString(),
      trial_end_date: trialEnd.toISOString(),
    });
    if (error) throw error;
    return;
  }

  // free_forever
  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);

  const { error } = await supabase.from("organization_subscriptions").insert({
    organization_id: organizationId,
    subscription_plan_id: plan.id,
    subscription_type: plan.name,
    status: "active",
    member_count: seats,
    billing_cycle: billingCycle,
    is_trial: false,
    auto_renew: true,
    current_member: 0,
    trial_start_date: null,
    trial_end_date: null,
    subscription_start_date: startDate,
    subscription_end_date: null,
  });
  if (error) throw error;
}

export function useCreateOnboardingSubscription() {
  return useMutation({
    mutationFn: insertOnboardingSubscription,
  });
}
