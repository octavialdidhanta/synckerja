import { useMemo } from "react";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";

export function useActiveOrganization() {
  const { data, isLoading, error } = useUserOrganizations();

  const organizationId = data?.activeOrganizationId ?? null;

  return useMemo(
    () => ({
      organizationId,
      loading: isLoading,
      error,
      userId: data?.userId ?? null,
    }),
    [organizationId, isLoading, error, data?.userId],
  );
}
