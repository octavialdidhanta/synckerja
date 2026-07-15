export const subscriptionQueryKeys = {
  status: (orgId: string) => ["subscriptionStatus", orgId] as const,
  plans: ["subscription-plans-active", "with-addons"] as const,
  planModuleAccess: (orgId: string, planId: string) =>
    ["plan-module-access", orgId, planId] as const,
  planModuleAccessOrgPrefix: (orgId: string) => ["plan-module-access", orgId] as const,
};
