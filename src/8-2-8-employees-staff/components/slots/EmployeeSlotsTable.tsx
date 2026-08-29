import { format } from "date-fns";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatPosStaffRole } from "../../lib/formatPosStaffRole";
import { derivePosStaffInviteStatus } from "../../lib/posStaffStatus";
import type { EmployeeSlotRow, PosStaffListItem } from "../../lib/posStaffTypes";

type Props = {
  rows: EmployeeSlotRow[];
  expiryDate: string | null;
  onSelectStaff: (staff: PosStaffListItem) => void;
  onInvite: () => void;
  onResend: (staff: PosStaffListItem) => void;
  resendingId?: string | null;
};

function formatExpiry(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd MMM yyyy");
}

export function EmployeeSlotsTable({
  rows,
  expiryDate,
  onSelectStaff,
  onInvite,
  onResend,
  resendingId,
}: Props) {
  const { t } = useAppTranslation();

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
        {t("employeesStaff.slots.empty", "No employee slots to display.")}
      </div>
    );
  }

  return (
    <div className="scrollbar-hide min-h-0 flex-1 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-gray-50">
          <TableRow>
            <TableHead>{t("employeesStaff.table.name", "Name")}</TableHead>
            <TableHead>{t("employeesStaff.table.role", "Role")}</TableHead>
            <TableHead>{t("employeesStaff.table.outlets", "Assigned Outlet")}</TableHead>
            <TableHead>{t("employeesStaff.table.expiry", "Expiry Date")}</TableHead>
            <TableHead>{t("employeesStaff.table.slotStatus", "Slot Status")}</TableHead>
            <TableHead>{t("employeesStaff.table.status", "Status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const status = derivePosStaffInviteStatus(row);

            if (row.kind === "empty") {
              return (
                <TableRow key={`empty-${row.slotIndex}`}>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {t("employeesStaff.slots.freeSlot", "Empty slot {{n}}", {
                      n: row.slotIndex,
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={onInvite}
                    >
                      {t("employeesStaff.actions.invite", "Invite Employee")}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            }

            const staff = row.staff;
            return (
              <TableRow
                key={staff.id}
                className="cursor-pointer"
                onClick={() => onSelectStaff(staff)}
              >
                <TableCell className="font-medium">{staff.full_name}</TableCell>
                <TableCell>{formatPosStaffRole(staff, t)}</TableCell>
                <TableCell>
                  {staff.all_outlets ? (
                    <Badge variant="secondary">
                      {t("employeesStaff.badge.allOutlets", "All Outlets")}
                    </Badge>
                  ) : staff.outlet_names.length > 0 ? (
                    <span className="text-sm">{staff.outlet_names.join(", ")}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatExpiry(expiryDate)}</TableCell>
                <TableCell>
                  <Badge variant={staff.is_active ? "default" : "outline"}>
                    {staff.is_active
                      ? t("employeesStaff.slots.occupied", "Occupied")
                      : t("employeesStaff.slots.inactive", "Inactive")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {status === "verified" ? (
                    <span className="text-sm font-medium text-foreground">
                      {t("employeesStaff.status.verified", "Verified")}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={resendingId === staff.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onResend(staff);
                      }}
                    >
                      {t("employeesStaff.actions.resend", "Resend Invitation")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
