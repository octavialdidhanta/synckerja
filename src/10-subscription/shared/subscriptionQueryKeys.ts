export const subscriptionQueryKeys = {
  status: (orgId: string) => ["subscriptionStatus", orgId] as const,
  plans: ["subscription-plans-active"] as const,
};
