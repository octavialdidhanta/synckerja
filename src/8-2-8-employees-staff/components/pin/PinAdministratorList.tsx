import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
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
import { EMPLOYEES_STAFF_SLOTS_PATH } from "../../layout/employeesStaffTabs";
import type { PosStaffListItem } from "../../lib/posStaffTypes";

export type PinAdminPinStatus = "ready" | "no_pin" | "not_allowed";

export type PinAdminRow = {
  key: string;
  outletName: string;
  staffName: string;
  staffId: string;
  pinStatus: PinAdminPinStatus;
  staff: PosStaffListItem;
};

type Props = {
  staff: PosStaffListItem[];
  onSelectStaff?: (staff: PosStaffListItem) => void;
};

function pinStatusFor(s: PosStaffListItem): PinAdminPinStatus {
  if (!s.has_pin) return "no_pin";
  if (!s.allow_pin_for_permissions) return "not_allowed";
  return "ready";
}

function buildAdminRows(staff: PosStaffListItem[]): PinAdminRow[] {
  const rows: PinAdminRow[] = [];
  for (const s of staff) {
    const isAdmin =
      s.role_slug === "administrator" || s.pos_role === "administrator";
    if (!s.is_active || !isAdmin) continue;

    const pinStatus = pinStatusFor(s);

    if (s.outlet_ids.length === 0 || s.all_outlets) {
      if (s.outlet_names.length === 0) {
        rows.push({
          key: `${s.id}:all`,
          outletName: "—",
          staffName: s.full_name,
          staffId: s.id,
          pinStatus,
          staff: s,
        });
      } else {
        for (let i = 0; i < s.outlet_names.length; i += 1) {
          rows.push({
            key: `${s.id}:${s.outlet_ids[i] ?? i}`,
            outletName: s.outlet_names[i] ?? "—",
            staffName: s.full_name,
            staffId: s.id,
            pinStatus,
            staff: s,
          });
        }
      }
      continue;
    }

    for (let i = 0; i < s.outlet_ids.length; i += 1) {
      rows.push({
        key: `${s.id}:${s.outlet_ids[i]}`,
        outletName: s.outlet_names[i] ?? "—",
        staffName: s.full_name,
        staffId: s.id,
        pinStatus,
        staff: s,
      });
    }
  }
  return rows.sort((a, b) =>
    `${a.outletName}${a.staffName}`.localeCompare(`${b.outletName}${b.staffName}`),
  );
}

export function PinAdministratorList({ staff, onSelectStaff }: Props) {
  const { t } = useAppTranslation();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const rows = useMemo(() => buildAdminRows(staff), [staff]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex-shrink-0 space-y-2 border-b px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("employeesStaff.pinAccess.adminListTitle", "List of Administrator")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(
            "employeesStaff.pinAccess.adminListHint",
            "All outlets are recommended to have at least 1 employee with administrator role and PIN assigned. To assign employee, go to",
          )}{" "}
          <Link to={EMPLOYEES_STAFF_SLOTS_PATH} className="font-medium text-primary hover:underline">
            {t("employeesStaff.tab.slots", "Employee Slots")}
          </Link>
          .
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {t(
              "employeesStaff.pinAccess.adminEmpty",
              "No administrators yet. Assign the Administrator role on Employee Access or Employee Slots.",
            )}
          </p>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60">
              <TableRow>
                <TableHead>{t("employeesStaff.pinAccess.colOutlet", "Outlet")}</TableHead>
                <TableHead>
                  {t("employeesStaff.pinAccess.colEmployee", "Employee Name")}
                </TableHead>
                <TableHead>{t("employeesStaff.pinAccess.colPin", "PIN")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const open = Boolean(revealed[row.key]);
                const clickable = Boolean(onSelectStaff);
                return (
                  <TableRow
                    key={row.key}
                    className={clickable ? "cursor-pointer hover:bg-muted/40" : undefined}
                    onClick={() => onSelectStaff?.(row.staff)}
                  >
                    <TableCell className="text-sm">{row.outletName}</TableCell>
                    <TableCell className="text-sm font-medium">{row.staffName}</TableCell>
                    <TableCell>
                      {row.pinStatus === "ready" ? (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="font-mono text-sm tracking-widest">
                            {open
                              ? t("employeesStaff.pinAccess.pinSet", "PIN set")
                              : "••••"}
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={
                              open
                                ? t("employeesStaff.pinAccess.hidePin", "Hide PIN status")
                                : t("employeesStaff.pinAccess.showPin", "Show PIN status")
                            }
                            onClick={() =>
                              setRevealed((prev) => ({ ...prev, [row.key]: !prev[row.key] }))
                            }
                          >
                            {open ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-amber-700 dark:text-amber-400">
                          {row.pinStatus === "no_pin"
                            ? t("employeesStaff.pinAccess.pinMissing", "No PIN — tap to set")
                            : t(
                                "employeesStaff.pinAccess.pinNotAllowed",
                                "PIN off — tap to enable",
                              )}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
