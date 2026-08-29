import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosEmployeeRoleRow } from "../../hooks/usePosEmployeeRoles";
import {
  countPosPrivileges,
  formatPosAccessSurface,
} from "../../lib/formatPosAccessSummary";

type Props = {
  roles: PosEmployeeRoleRow[];
  onSelect: (role: PosEmployeeRoleRow) => void;
};

export function EmployeeAccessRolesTable({ roles, onSelect }: Props) {
  const { t } = useAppTranslation();

  if (roles.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
        {t("employeesStaff.access.noRoles", "No roles yet. Create an employee role.")}
      </div>
    );
  }

  return (
    <div className="scrollbar-hide min-h-0 flex-1 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-gray-50">
          <TableRow>
            <TableHead>{t("employeesStaff.access.colRole", "Role Name")}</TableHead>
            <TableHead>
              {t("employeesStaff.access.colEmployees", "Employees Assigned")}
            </TableHead>
            <TableHead>{t("employeesStaff.access.colAccess", "Access")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => {
            const surface = formatPosAccessSurface(role.permission_keys);
            const count = countPosPrivileges(role.permission_keys);
            const surfaceLabel =
              surface === "app_and_backoffice"
                ? t("employeesStaff.access.surfaceBoth", "App & Back-office")
                : surface === "app_only"
                  ? t("employeesStaff.access.surfaceApp", "App Only")
                  : surface === "backoffice_only"
                    ? t("employeesStaff.access.surfaceBackoffice", "Back-office Only")
                    : t("employeesStaff.access.surfaceNone", "None");

            const employeesLabel =
              role.staff_names.length === 0
                ? "—"
                : role.staff_names.length === 1
                  ? role.staff_names[0]
                  : t("employeesStaff.access.nEmployees", "{{n}} Employees", {
                      n: role.staff_names.length,
                    });

            return (
              <TableRow
                key={role.id}
                className="cursor-pointer"
                onClick={() => onSelect(role)}
              >
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell>
                  {role.staff_names.length > 1 ? (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">
                      {employeesLabel}
                    </Badge>
                  ) : (
                    <span className="text-sm">{employeesLabel}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-sm text-foreground">{surfaceLabel}</span>
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                      {t("employeesStaff.access.nPrivileges", "{{n}} Privileges", {
                        n: count,
                      })}
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
