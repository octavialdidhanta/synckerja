import type { EmployeeSlotRow, PosStaffListItem } from "./posStaffTypes";

export type PosStaffInviteStatus = "verified" | "pending" | "empty";

export function derivePosStaffInviteStatus(
  row: EmployeeSlotRow,
): PosStaffInviteStatus {
  if (row.kind === "empty") return "empty";
  if (row.staff.verified_at) return "verified";
  return "pending";
}

export function isPosStaffPending(staff: PosStaffListItem): boolean {
  return !staff.verified_at;
}

export function isPosStaffVerified(staff: PosStaffListItem): boolean {
  return Boolean(staff.verified_at);
}
