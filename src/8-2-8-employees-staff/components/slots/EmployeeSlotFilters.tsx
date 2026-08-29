import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type SlotStatusFilter = "all" | "active" | "inactive" | "empty";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: SlotStatusFilter;
  onStatusFilterChange: (value: SlotStatusFilter) => void;
  onExport: () => void;
  onInvite: () => void;
};

export function EmployeeSlotFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onExport,
  onInvite,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as SlotStatusFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("employeesStaff.filter.all", "All")}</SelectItem>
            <SelectItem value="active">{t("employeesStaff.filter.active", "Active")}</SelectItem>
            <SelectItem value="inactive">{t("employeesStaff.filter.inactive", "Inactive")}</SelectItem>
            <SelectItem value="empty">{t("employeesStaff.filter.empty", "Empty slots")}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="min-w-[160px] flex-1"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("employeesStaff.filter.search", "Name, email, role")}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onExport}>
          {t("employeesStaff.actions.export", "Export")}
        </Button>
        <Button type="button" size="sm" onClick={onInvite}>
          {t("employeesStaff.actions.invite", "Invite Employee")}
        </Button>
      </div>
    </div>
  );
}
