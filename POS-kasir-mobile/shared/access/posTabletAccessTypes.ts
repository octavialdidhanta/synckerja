/** Tablet `/pos/*` access decision (fail-closed). */
export type PosTabletAccessStatus = "loading" | "allowed" | "denied";

/** Why access was allowed or denied (null while loading). */
export type PosTabletAccessReason =
  | "staff"
  | "addon_inactive"
  | "not_staff"
  | null;

export type PosTabletStaffMembership = {
  staffId: string;
  /** Empty array = all active org outlets (same rule as PIN / Administrator). */
  outletIds: string[];
};
