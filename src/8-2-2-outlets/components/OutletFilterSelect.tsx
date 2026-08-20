import { Badge } from "@/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_OUTLET_FILTER_ALL } from "../lib/assignedOutlets";
import { usePosOutlets } from "../hooks/usePosOutlets";

export type OutletFilterSelectProps = {
  value: string;
  onChange: (id: string) => void;
  className?: string;
  disabled?: boolean;
  includeAll?: boolean;
};

export function OutletFilterSelect({
  value,
  onChange,
  className,
  disabled,
  includeAll = false,
}: OutletFilterSelectProps) {
  const { t } = useAppTranslation();
  const { rows, isLoading } = usePosOutlets();
  const allLabel = t("outlets.filter.all", "All Outlets");
  const selected = rows.find((row) => row.id === value);
  const displayLabel =
    includeAll && value === POS_OUTLET_FILTER_ALL
      ? allLabel
      : selected
        ? selected.name
        : t("outlets.filter.placeholder", "Outlet");
  const noChoices = includeAll ? false : rows.length === 0;

  return (
    <Select
      value={value || undefined}
      onValueChange={onChange}
      disabled={disabled || isLoading || noChoices}
    >
      <SelectTrigger className={cn("h-9 w-[180px]", className)} aria-label={t("outlets.filter.label", "Outlet")}>
        <SelectValue placeholder={t("outlets.filter.placeholder", "Outlet")}>
          {displayLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {includeAll ? (
          <SelectItem value={POS_OUTLET_FILTER_ALL}>{allLabel}</SelectItem>
        ) : null}
        {rows.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            <span className="flex items-center gap-2">
              <span className="truncate">{row.name}</span>
              {row.is_active ? null : (
                <Badge variant="secondary">{t("outlets.statusInactive", "Inactive")}</Badge>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
