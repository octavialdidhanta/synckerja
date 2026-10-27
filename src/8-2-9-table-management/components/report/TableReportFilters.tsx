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
    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <h2 className="flex h-10 shrink-0 items-center whitespace-nowrap text-lg font-semibold leading-none text-gray-900">
        {t("tableManagement.report.title", "Table Report")}
      </h2>
      <OutletFilterSelect
        value={outletId}
        onChange={onOutletChange}
        className="h-10 w-[180px] shrink-0"
      />
      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className="h-10 w-[150px] shrink-0 bg-white"
        aria-label={t("tableManagement.report.dateFrom", "From")}
      />
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="h-10 w-[150px] shrink-0 bg-white"
        aria-label={t("tableManagement.report.dateTo", "To")}
      />
      <Select
        value={tableKey ?? "all"}
        onValueChange={(v) => onTableKeyChange(v === "all" ? null : v)}
      >
        <SelectTrigger
          className="h-10 w-[160px] shrink-0 bg-white"
          aria-label={t("tableManagement.report.filterTable", "Table")}
        >
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
  );
}
