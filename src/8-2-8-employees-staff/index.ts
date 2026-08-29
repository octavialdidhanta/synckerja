export {
  EMPLOYEES_STAFF_BASE_PATH,
  EMPLOYEES_STAFF_SLOTS_PATH,
  EMPLOYEES_STAFF_ACCESS_PATH,
  EMPLOYEES_STAFF_PIN_PATH,
  employeesStaffTabFromPathname,
  employeesStaffTabPath,
  employeesStaffTabLocation,
} from "./layout/employeesStaffTabs";
export type { EmployeesStaffSubTab } from "./layout/employeesStaffTabs";
export { EmployeesStaffHeaderAndTab } from "./layout/EmployeesStaffHeaderAndTab";
export { EmployeesStaffModuleShell } from "./layout/EmployeesStaffModuleShell";
export { EmployeesStaffPageSkeleton } from "./pages/EmployeesStaffPageSkeleton";
export {
  usePosEmployeeRoles,
  useEnsurePosDefaultRoles,
  POS_EMPLOYEE_ROLES_QUERY_KEY,
} from "./hooks/usePosEmployeeRoles";
export type { PosEmployeeRoleRow, PosRoleSavePayload } from "./hooks/usePosEmployeeRoles";
export { usePosStaffRoleAssignment } from "./hooks/usePosStaffRoleAssignment";
export {
  usePosStaffPermissions,
  filterPosBackofficeNavItems,
  POS_CURRENT_STAFF_PERMISSIONS_KEY,
} from "./hooks/usePosStaffPermissions";
export type { PosStaffPermissionsState } from "./hooks/usePosStaffPermissions";
export { usePosEmployeeStaff, POS_EMPLOYEE_STAFF_QUERY_KEY } from "./hooks/usePosEmployeeStaff";
export { usePosStaffPin, POS_PIN_ACCESS_SETTINGS_QUERY_KEY } from "./hooks/usePosStaffPin";
export { usePosPinAccessSettings } from "./hooks/usePosPinAccessSettings";
export { usePosStaffInvite } from "./hooks/usePosStaffInvite";
export { usePosStaffVerification, isPosUserMagicVerified } from "./hooks/usePosStaffVerification";
export {
  derivePosStaffInviteStatus,
  isPosStaffPending,
  isPosStaffVerified,
} from "./lib/posStaffStatus";
export type { PosStaffInviteStatus } from "./lib/posStaffStatus";
export {
  resolveOutletIdsForRole,
  validateOutletsForRole,
  countActiveAdministrators,
} from "./lib/posStaffRoleRules";
