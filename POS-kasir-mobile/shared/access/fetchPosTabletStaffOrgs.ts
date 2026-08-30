import { supabase } from "@/shared/lib/supabaseClient";
import type { PosStaffOrgCandidate } from "./pickPosTabletOrganization";

type EmployeeStaffRow = {
  id: string;
  organization_id: string;
  pos_employee_staff:
    | { id: string; role_id: string | null; is_active: boolean }
    | { id: string; role_id: string | null; is_active: boolean }[]
    | null;
};

function asStaffRows(
  raw: EmployeeStaffRow["pos_employee_staff"],
): { id: string; role_id: string | null; is_active: boolean }[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Orgs where the user has an active Slot Karyawan row with role_id,
 * plus whether that org's POS add-on is on (table flag or paid outlet extras).
 */
export async function fetchPosTabletStaffOrgs(
  userId: string,
): Promise<PosStaffOrgCandidate[]> {
  const { data: empRows, error: empError } = await supabase
    .from("employees")
    .select(
      `
      id,
      organization_id,
      pos_employee_staff!inner (
        id,
        role_id,
        is_active
      )
    `,
    )
    .eq("user_id", userId)
    .eq("pos_employee_staff.is_active", true);

  if (empError) throw empError;

  const staffOrgIds = new Set<string>();
  for (const row of (empRows ?? []) as EmployeeStaffRow[]) {
    const hasRole = asStaffRows(row.pos_employee_staff).some(
      (s) => s.is_active && Boolean(s.role_id),
    );
    if (hasRole && row.organization_id) {
      staffOrgIds.add(String(row.organization_id));
    }
  }

  if (staffOrgIds.size === 0) return [];

  const orgIds = [...staffOrgIds];
  const { data: subs, error: subError } = await supabase
    .from("organization_subscriptions")
    .select("organization_id, pos_addon_active, pos_paid_outlet_count")
    .in("organization_id", orgIds);

  if (subError) throw subError;

  const addonByOrg = new Map<string, boolean>();
  for (const row of subs ?? []) {
    const id = String((row as { organization_id: string }).organization_id);
    const active = Boolean((row as { pos_addon_active?: boolean }).pos_addon_active);
    const paid = Number((row as { pos_paid_outlet_count?: number }).pos_paid_outlet_count ?? 0);
    addonByOrg.set(id, active || (Number.isFinite(paid) && paid > 0));
  }

  return orgIds.map((organizationId) => ({
    organizationId,
    addonActive: addonByOrg.get(organizationId) ?? false,
  }));
}
