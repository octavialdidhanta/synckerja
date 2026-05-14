import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import type { OmnichannelStaffRole } from "@/shared/hooks/useOrganizationOmnichannelStaff";
import { cn } from "@/shared/lib/utils";

export type UserManagementRoleFilter = "all" | OmnichannelStaffRole;

type UserManagementToolbarProps = {
  roleFilter: UserManagementRoleFilter;
  onRoleFilterChange: (value: UserManagementRoleFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  /** DB role values shown in the filter (labels translated in-toolbar). */
  roleOptionValues: readonly OmnichannelStaffRole[];
  /** Primary action on the right; role + search stay grouped on the left. */
  endContent?: ReactNode;
  /** When true, single row aligned end (for card header strip). */
  headerCluster?: boolean;
  className?: string;
};

export function UserManagementToolbar({
  roleFilter,
  onRoleFilterChange,
  search,
  onSearchChange,
  roleOptionValues,
  endContent,
  headerCluster = false,
  className,
}: UserManagementToolbarProps) {
  const { t } = useTranslation();

  const labelForRole = (role: OmnichannelStaffRole) =>
    role === "admin" ? t("omnichannel.settings.userManagement.roleAdminOmnichannel") : t(`omnichannel.settings.userManagement.role.${role}`);

  const roleSelect = (
    <div className={cn("shrink-0", headerCluster ? "w-[min(200px,100%)]" : "w-full sm:w-[220px]")}>
      <Select value={roleFilter} onValueChange={(v) => onRoleFilterChange(v as UserManagementRoleFilter)}>
        <SelectTrigger className="h-9 w-full bg-background sm:h-10">
          <SelectValue placeholder={t("omnichannel.settings.userManagement.allRoles")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("omnichannel.settings.userManagement.allRoles")}</SelectItem>
          {roleOptionValues.map((role) => (
            <SelectItem key={role} value={role}>
              {labelForRole(role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const searchField = (
    <div
      className={cn(
        "relative min-w-0",
        headerCluster ? "relative min-w-0 w-full max-w-sm shrink sm:w-64 md:w-72" : "w-full flex-1 sm:max-w-md",
      )}
    >
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t("omnichannel.settings.userManagement.searchPlaceholder")}
        className={cn("pl-9", headerCluster ? "h-9 sm:h-10" : "h-10")}
        aria-label={t("omnichannel.settings.userManagement.searchPlaceholder")}
      />
    </div>
  );

  if (headerCluster) {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap sm:justify-end",
          className,
        )}
      >
        {roleSelect}
        {searchField}
        {endContent ? <div className="flex shrink-0 justify-end">{endContent}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {roleSelect}
        {searchField}
      </div>
      {endContent ? (
        <div className="flex w-full shrink-0 justify-end sm:ml-auto sm:w-auto">{endContent}</div>
      ) : null}
    </div>
  );
}
