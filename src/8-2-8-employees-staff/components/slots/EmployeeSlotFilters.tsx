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
  title: string;
  quotaLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: SlotStatusFilter;
  onStatusFilterChange: (value: SlotStatusFilter) => void;
  onExport: () => void;
  onInvite: () => void;
};

export function EmployeeSlotFilters({
  title,
  quotaLabel,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onExport,
  onInvite,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex h-10 shrink-0 items-center gap-2">
        <h2 className="whitespace-nowrap text-lg font-semibold leading-none text-gray-900">
          {title}
        </h2>
        <span className="whitespace-nowrap text-xs text-muted-foreground">{quotaLabel}</span>
      </div>
      <Select
        value={statusFilter}
        onValueChange={(v) => onStatusFilterChange(v as SlotStatusFilter)}
      >
        <SelectTrigger className="h-10 w-[140px] shrink-0">
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
        className="h-10 min-w-[160px] flex-1"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t("employeesStaff.filter.search", "Name, email, role")}
      />
      <Button type="button" variant="outline" className="h-10 shrink-0" onClick={onExport}>
        {t("employeesStaff.actions.export", "Export")}
      </Button>
      <Button type="button" className="h-10 shrink-0" onClick={onInvite}>
        {t("employeesStaff.actions.invite", "Invite Employee")}
      </Button>
    </div>
  );
}
