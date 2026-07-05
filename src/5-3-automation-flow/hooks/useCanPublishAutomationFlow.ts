import { useMemo } from "react";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOrganizationOmnichannelStaff } from "@/shared/hooks/useOrganizationOmnichannelStaff";

export function useCanPublishAutomationFlow(): {
  canPublish: boolean;
  isLoading: boolean;
} {
  const { organizationId } = useCurrentOrg();
  const { employee, isOwner, centralProfileHydrated, loading: centralLoading } = useCentralizedUserData();
  const { data: roster = [], isPending: rosterPending } = useOrganizationOmnichannelStaff();

  const isOmnichannelAdmin = useMemo(() => {
    if (!employee?.id) return false;
    return roster.some((r) => r.employee_id === employee.id && r.role === "admin");
  }, [employee?.id, roster]);

  const canPublish = isOwner || isOmnichannelAdmin;
  const isLoading =
    !organizationId ||
    !centralProfileHydrated ||
    centralLoading ||
    (!isOwner && (rosterPending || !employee?.id));

  return { canPublish, isLoading };
}
