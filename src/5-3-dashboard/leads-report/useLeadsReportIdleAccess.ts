import { useOmnichannelSurveySettingsAdmin } from "@/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useOrganizationOmnichannelStaff } from "@/shared/hooks/useOrganizationOmnichannelStaff";

export function useLeadsReportIdleAccess() {
  const { canManage: canViewIdleAgentsRaw, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: omnichannelRoster = [], isPending: omnichannelRosterLoading } =
    useOrganizationOmnichannelStaff();

  const canViewIdleAgents = canViewIdleAgentsRaw && !gatePending;

  return {
    canViewIdleAgents,
    canViewIdleAgentsRaw,
    gatePending,
    omnichannelRoster,
    omnichannelRosterLoading,
    idleTabGatePending: gatePending,
  };
}
