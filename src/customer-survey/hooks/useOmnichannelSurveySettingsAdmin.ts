import { useMemo } from "react";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOrganizationOmnichannelStaff } from "@/shared/hooks/useOrganizationOmnichannelStaff";

/** Owner or omnichannel roster admin — matches `is_omnichannel_survey_settings_admin` RLS. */
export function useOmnichannelSurveySettingsAdmin() {
  const { organizationId } = useCurrentOrg();
  const { employee, isOwner, centralProfileHydrated, loading: centralLoading } = useCentralizedUserData();
  const { data: roster = [], isPending: rosterPending } = useOrganizationOmnichannelStaff();

  const isOmnichannelAdmin = useMemo(() => {
    if (!employee?.id) return false;
    return roster.some((r) => r.employee_id === employee.id && r.role === "admin");
  }, [employee?.id, roster]);

  const canManage = isOwner || isOmnichannelAdmin;

  const gatePending =
    !organizationId ||
    !centralProfileHydrated ||
    centralLoading ||
    (!isOwner && (rosterPending || !employee?.id));

  return {
    organizationId,
    canManage,
    gatePending,
    isOwner,
    isOmnichannelAdmin,
  };
}
