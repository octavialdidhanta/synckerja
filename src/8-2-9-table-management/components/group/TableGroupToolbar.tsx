import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";

type Props = {
  outletId: string;
  onOutletChange: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
};

export function TableGroupToolbar({
  outletId,
  onOutletChange,
  search,
  onSearchChange,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <OutletFilterSelect value={outletId} onChange={onOutletChange} />
      <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("tableManagement.group.search", "Search")}
          className="h-9 pl-8"
          aria-label={t("tableManagement.group.search", "Search")}
        />
      </div>
    </div>
  );
}
