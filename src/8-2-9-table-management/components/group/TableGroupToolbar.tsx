import { Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";

type Props = {
  outletId: string;
  onOutletChange: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  createDisabled?: boolean;
};

export function TableGroupToolbar({
  outletId,
  onOutletChange,
  search,
  onSearchChange,
  onCreate,
  createDisabled,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <h2 className="flex h-10 shrink-0 items-center whitespace-nowrap text-lg font-semibold leading-none text-gray-900">
        {t("tableManagement.group.title", "Table Group")}
      </h2>
      <OutletFilterSelect
        value={outletId}
        onChange={onOutletChange}
        className="h-10 w-[180px] shrink-0"
      />
      <div className="relative min-w-[160px] flex-1">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("tableManagement.group.search", "Search")}
          className="h-10 pr-10"
          aria-label={t("tableManagement.group.search", "Search")}
        />
      </div>
      <Button type="button" className="h-10 shrink-0" onClick={onCreate} disabled={createDisabled}>
        {t("tableManagement.group.create", "Create Table Group")}
      </Button>
    </div>
  );
}
