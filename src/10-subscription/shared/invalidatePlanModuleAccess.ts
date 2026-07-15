import type { QueryClient } from "@tanstack/react-query";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";

export function invalidatePlanModuleAccessForOrg(
  queryClient: QueryClient,
  organizationId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: subscriptionQueryKeys.planModuleAccessOrgPrefix(organizationId),
    refetchType: "active",
  });
}
