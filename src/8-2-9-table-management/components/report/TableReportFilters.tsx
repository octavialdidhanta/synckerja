import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type TableOpt = { value: string; label: string };

type Props = {
  outletId: string;
  onOutletChange: (id: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  tableKey: string | null;
  onTableKeyChange: (v: string | null) => void;
  tableOptions: TableOpt[];
};

export function TableReportFilters({
  outletId,
  onOutletChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  tableKey,
  onTableKeyChange,
  tableOptions,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[160px]">
        <OutletFilterSelect value={outletId} onChange={onOutletChange} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground">
          {t("tableManagement.report.dateFrom", "From")}
        </label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-9 w-[150px] bg-white"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground">
          {t("tableManagement.report.dateTo", "To")}
        </label>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-9 w-[150px] bg-white"
        />
      </div>
      <div className="min-w-[160px]">
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
          {t("tableManagement.report.filterTable", "Table")}
        </label>
        <Select
          value={tableKey ?? "all"}
          onValueChange={(v) => onTableKeyChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="h-9 bg-white">
            <SelectValue placeholder={t("tableManagement.report.allTables", "All")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("tableManagement.report.allTables", "All")}</SelectItem>
            {tableOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
