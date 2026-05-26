import { useEffect, useMemo, useState } from "react";
import type { NewLead } from "@/shared/types/leads";
import type { OrganizationOmnichannelStaffRow } from "@/shared/hooks/useOrganizationOmnichannelStaff";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOmnichannelStaffPresence } from "@/5-3-dashboard/hooks/useOmnichannelStaffPresence";
import {
  buildIdleAgentRows,
  buildIdleSinceMapForRoster,
  readPersistedIdleSinceMap,
  summarizeIdleAgentRows,
  writePersistedIdleSinceMap,
  type IdleAgentRow,
} from "@/5-3-dashboard/components/leads/metrics/idleAgentsUtils";

type UseIdleAgentRowsArgs = {
  /** For active chat counts + idle/busy status (respects page filters). */
  filteredLeads: NewLead[];
  /** Org-wide leads for inferring idle start from `updated_at` (survives refresh). */
  allLeads: NewLead[];
  roster: OrganizationOmnichannelStaffRow[];
  rosterLoading?: boolean;
};

export function useIdleAgentRows({
  filteredLeads,
  allLeads,
  roster,
  rosterLoading = false,
}: UseIdleAgentRowsArgs) {
  const { organizationId } = useCurrentOrg();
  const { presenceByUserId } = useOmnichannelStaffPresence();
  const [nowMs, setNowMs] = useState(() => Date.now());

  const idleSinceByEmployeeId = useMemo(
    () =>
      buildIdleSinceMapForRoster(
        roster,
        filteredLeads,
        allLeads,
        presenceByUserId,
        organizationId,
        nowMs,
      ),
    [roster, filteredLeads, allLeads, presenceByUserId, organizationId, nowMs],
  );

  useEffect(() => {
    if (!organizationId) return;
    const stored = readPersistedIdleSinceMap(organizationId);
    const merged = { ...stored };
    for (const [employeeId, since] of Object.entries(idleSinceByEmployeeId)) {
      merged[employeeId] = since;
    }
    for (const employeeId of Object.keys(merged)) {
      if (!(employeeId in idleSinceByEmployeeId)) {
        delete merged[employeeId];
      }
    }
    writePersistedIdleSinceMap(organizationId, merged);
  }, [organizationId, idleSinceByEmployeeId]);

  const hasIdle = Object.keys(idleSinceByEmployeeId).length > 0;

  useEffect(() => {
    const ms = hasIdle ? 1000 : 30_000;
    const id = window.setInterval(() => setNowMs(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [hasIdle]);

  const rows: IdleAgentRow[] = useMemo(
    () =>
      buildIdleAgentRows(
        roster,
        filteredLeads,
        presenceByUserId,
        idleSinceByEmployeeId,
        nowMs,
      ),
    [roster, filteredLeads, presenceByUserId, idleSinceByEmployeeId, nowMs],
  );

  const summary = useMemo(() => summarizeIdleAgentRows(rows), [rows]);

  return {
    rows,
    summary,
    pending: rosterLoading,
  };
}
