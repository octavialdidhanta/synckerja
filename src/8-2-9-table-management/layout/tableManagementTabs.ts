export const TABLE_MANAGEMENT_BASE_PATH = "/operations/table-management";
export const TABLE_MANAGEMENT_GROUP_PATH = "/operations/table-management/group";
export const TABLE_MANAGEMENT_MAP_PATH = "/operations/table-management/map";
export const TABLE_MANAGEMENT_REPORT_PATH = "/operations/table-management/report";

export type TableManagementSubTab = "group" | "map" | "report";

export function tableManagementTabFromPathname(pathname: string): TableManagementSubTab {
  if (pathname.startsWith(TABLE_MANAGEMENT_MAP_PATH)) return "map";
  if (pathname.startsWith(TABLE_MANAGEMENT_REPORT_PATH)) return "report";
  return "group";
}

export function tableManagementTabPath(tab: TableManagementSubTab): string {
  if (tab === "map") return TABLE_MANAGEMENT_MAP_PATH;
  if (tab === "report") return TABLE_MANAGEMENT_REPORT_PATH;
  return TABLE_MANAGEMENT_GROUP_PATH;
}

export function tableManagementTabLocation(
  path: string,
  search: string,
): { pathname: string; search: string } {
  return { pathname: path, search };
}
