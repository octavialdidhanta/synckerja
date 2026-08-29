export const EMPLOYEES_STAFF_BASE_PATH = "/operations/employees-staff";
export const EMPLOYEES_STAFF_SLOTS_PATH = "/operations/employees-staff/slots";
export const EMPLOYEES_STAFF_ACCESS_PATH = "/operations/employees-staff/access";
export const EMPLOYEES_STAFF_PIN_PATH = "/operations/employees-staff/pin-access";

export type EmployeesStaffSubTab = "slots" | "access" | "pin-access";

export function employeesStaffTabFromPathname(pathname: string): EmployeesStaffSubTab {
  if (pathname.startsWith(EMPLOYEES_STAFF_PIN_PATH)) return "pin-access";
  if (pathname.startsWith(EMPLOYEES_STAFF_ACCESS_PATH)) return "access";
  return "slots";
}

export function employeesStaffTabPath(tab: EmployeesStaffSubTab): string {
  if (tab === "pin-access") return EMPLOYEES_STAFF_PIN_PATH;
  if (tab === "access") return EMPLOYEES_STAFF_ACCESS_PATH;
  return EMPLOYEES_STAFF_SLOTS_PATH;
}

export function employeesStaffTabLocation(
  path: string,
  search: string,
): { pathname: string; search: string } {
  return { pathname: path, search };
}
