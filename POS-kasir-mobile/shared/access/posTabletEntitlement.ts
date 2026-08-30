import type { PosTabletAccessReason, PosTabletAccessStatus } from "./posTabletAccessTypes";

export type ResolvePosTabletAccessInput = {
  /** Subscription / membership still loading. */
  loading: boolean;
  /** Plans Sertakan / pos_addon_active. */
  addonActive: boolean;
  /** Active Slot Karyawan row with role_id. */
  hasStaffWithRole: boolean;
};

export type ResolvePosTabletAccessResult = {
  status: PosTabletAccessStatus;
  reason: PosTabletAccessReason;
};

/**
 * Pure dual-gate for tablet `/pos/*`:
 * addon must be active AND staff+role — no Owner/Admin bypass.
 */
export function resolvePosTabletAccess(
  input: ResolvePosTabletAccessInput,
): ResolvePosTabletAccessResult {
  if (input.loading) {
    return { status: "loading", reason: null };
  }
  if (!input.addonActive) {
    return { status: "denied", reason: "addon_inactive" };
  }
  if (input.hasStaffWithRole) {
    return { status: "allowed", reason: "staff" };
  }
  return { status: "denied", reason: "not_staff" };
}
