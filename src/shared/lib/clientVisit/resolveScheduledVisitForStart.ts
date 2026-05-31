import { supabase } from '@/shared/lib/supabaseClient';

export type ScheduledVisitCandidate = {
  id: string;
  planned_start_time?: string | null;
  planned_end_time?: string | null;
  lead_client_id?: string | null;
  visit_purpose?: string | null;
  validated_location_id?: string | null;
};

const SCHEDULED_VISIT_START_SELECT =
  'id, planned_start_time, planned_end_time, lead_client_id, visit_purpose, validated_location_id';

export async function fetchScheduledVisitsForStart(params: {
  employeeId: string;
  organizationId: string;
  visitDateYmd: string;
}): Promise<ScheduledVisitCandidate[]> {
  const { data, error } = await supabase
    .from('client_visits')
    .select(SCHEDULED_VISIT_START_SELECT)
    .eq('employee_id', params.employeeId)
    .eq('organization_id', params.organizationId)
    .eq('visit_date', params.visitDateYmd)
    .eq('status', 'scheduled')
    .order('planned_start_time', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ScheduledVisitCandidate[];
}

/**
 * Pick the scheduled visit row to UPDATE when starting a visit on mobile.
 * GPS may resolve a different office_locations.id than the row created from wizard
 * (duplicate client sites at the same address).
 */
export function pickScheduledVisitForStart(
  rows: ScheduledVisitCandidate[],
  locationId: string,
  clientId?: string | null,
): ScheduledVisitCandidate | null {
  if (!rows.length) return null;

  const exact = rows.find((row) => row.validated_location_id === locationId);
  if (exact) return exact;

  if (clientId) {
    const sameClient = rows.filter((row) => row.lead_client_id === clientId);
    if (sameClient.length >= 1) {
      return [...sameClient].sort((a, b) =>
        (a.planned_start_time ?? '').localeCompare(b.planned_start_time ?? ''),
      )[0];
    }
  }

  if (rows.length === 1) return rows[0];

  return [...rows].sort((a, b) =>
    (a.planned_start_time ?? '').localeCompare(b.planned_start_time ?? ''),
  )[0];
}

export async function resolveScheduledVisitForStart(params: {
  employeeId: string;
  organizationId: string;
  visitDateYmd: string;
  locationId: string;
  clientId?: string | null;
}): Promise<ScheduledVisitCandidate | null> {
  const rows = await fetchScheduledVisitsForStart({
    employeeId: params.employeeId,
    organizationId: params.organizationId,
    visitDateYmd: params.visitDateYmd,
  });
  return pickScheduledVisitForStart(rows, params.locationId, params.clientId ?? null);
}
