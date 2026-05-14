import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";
import type { OmnichannelUserManagementRow } from "@/5-3-dashboard/omnichannel-settings/types/userManagement.types";
import type { OmnichannelStaffRole } from "@/shared/hooks/useOrganizationOmnichannelStaff";

const ROLES: OmnichannelStaffRole[] = ["agent", "supervisor", "admin"];

type UserManagementTableProps = {
  rows: OmnichannelUserManagementRow[];
  onRoleChange: (rosterId: string, role: OmnichannelStaffRole) => void;
  onRemove: (row: OmnichannelUserManagementRow) => void;
  busyRosterId?: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function UserManagementTable({ rows, onRoleChange, onRemove, busyRosterId }: UserManagementTableProps) {
  const { t } = useTranslation();

  const roleLabel = (role: OmnichannelStaffRole) => {
    if (role === "admin") return t("omnichannel.settings.userManagement.roleAdminOmnichannel");
    return t(`omnichannel.settings.userManagement.role.${role}`);
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-[220px]">{t("omnichannel.settings.userManagement.colName")}</TableHead>
            <TableHead className="w-[120px]">{t("omnichannel.settings.userManagement.colStatus")}</TableHead>
            <TableHead>{t("omnichannel.settings.userManagement.colPhone")}</TableHead>
            <TableHead>{t("omnichannel.settings.userManagement.colEmail")}</TableHead>
            <TableHead className="w-[160px]">{t("omnichannel.settings.userManagement.colRole")}</TableHead>
            <TableHead className="w-[100px] text-right">{t("omnichannel.settings.userManagement.colActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                {t("omnichannel.settings.userManagement.empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.rosterId}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0 border border-border bg-muted">
                      <AvatarFallback className="text-xs font-medium">{initials(row.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium text-foreground">{row.fullName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        row.presenceStatus === "online" ? "bg-emerald-500" : "bg-muted-foreground/50",
                      )}
                      aria-hidden
                    />
                    <span className="text-sm text-muted-foreground">
                      {row.presenceStatus === "online"
                        ? t("omnichannel.settings.userManagement.statusOnline")
                        : t("omnichannel.settings.userManagement.statusOffline")}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{row.phone || "—"}</TableCell>
                <TableCell className="max-w-[240px] truncate text-sm">{row.email}</TableCell>
                <TableCell>
                  <Select
                    value={row.role}
                    onValueChange={(v) => onRoleChange(row.rosterId, v as OmnichannelStaffRole)}
                    disabled={busyRosterId === row.rosterId}
                  >
                    <SelectTrigger className="h-9 w-full max-w-[180px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={busyRosterId === row.rosterId}
                    onClick={() => onRemove(row)}
                  >
                    {t("omnichannel.settings.userManagement.removeFromRoster")}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
