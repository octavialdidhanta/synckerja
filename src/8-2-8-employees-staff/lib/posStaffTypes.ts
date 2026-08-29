export type PosStaffRole = "administrator" | "cashier";

export type PosEmployeeStaffRow = {
  id: string;
  organization_id: string;
  employee_id: string;
  pos_role: PosStaffRole;
  role_id: string | null;
  pin_enabled: boolean;
  allow_pin_for_permissions: boolean;
  description: string | null;
  is_active: boolean;
  invited_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  /** Present when pin_hash is set (never expose hash to UI). */
  has_pin: boolean;
};

export type PosStaffOutletAssignment = {
  staff_id: string;
  outlet_id: string;
  outlet_name: string;
};

export type PosStaffListItem = PosEmployeeStaffRow & {
  full_name: string;
  email: string | null;
  mobile_phone: string | null;
  employee_status: string | null;
  /** Auth user id from HR employees row (needed for magic-link / verify). */
  user_id: string | null;
  outlet_ids: string[];
  outlet_names: string[];
  all_outlets: boolean;
  /** From `pos_employee_roles` via `role_id` (Access source of truth). */
  role_name: string | null;
  role_slug: string | null;
  role_is_system: boolean;
};

export type PosPinAccessSettings = {
  organization_id: string;
  require_pin_for_void: boolean;
  require_pin_for_refund: boolean;
  require_pin_for_discount: boolean;
  require_pin_for_cash_drawer: boolean;
  required_features: string[];
};

export type EmployeeSlotRow =
  | { kind: "staff"; staff: PosStaffListItem }
  | { kind: "empty"; slotIndex: number };

export type PosStaffSavePayload = {
  id?: string;
  employee_id: string;
  pos_role: PosStaffRole;
  /** When set, used as-is; otherwise resolved from system role slug matching `pos_role`. */
  role_id?: string | null;
  description?: string | null;
  is_active?: boolean;
  allow_pin_for_permissions?: boolean;
  outlet_ids?: string[];
  mark_invited?: boolean;
  /** When true, sets verified_at = now() (and keeps invited_at if already set). */
  mark_verified?: boolean;
  invited_at?: string | null;
  verified_at?: string | null;
};
