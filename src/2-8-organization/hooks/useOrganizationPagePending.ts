import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOrganizationalStructure } from "./useOrganizationalStructure";

/**
 * Aggregated pending state for /company/organization:
 * - Centralized user/org bootstrap
 * - Current org profile resolution
 * - No org id → pending
 * - Structure hook (employees + departments + job positions) → pending until first load completes
 */
export function useOrganizationPagePending(): boolean {
  const { loading: userDataLoading } = useCentralizedUserData();
  const { organizationId, loading: orgProfileLoading } = useCurrentOrg();
  const { isLoading } = useOrganizationalStructure();

  if (userDataLoading || orgProfileLoading) return true;
  if (!organizationId) return true;
  return isLoading;
}
