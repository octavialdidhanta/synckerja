import { useState } from "react";
import { Download, Plus, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function SuppliersToolbar(props: {
  search: string;
  onSearchChange: (value: string) => void;
  onExport: () => void;
  onCreate: () => void;
  exporting?: boolean;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <h2 className="flex h-10 shrink-0 items-center whitespace-nowrap text-lg font-semibold leading-none text-gray-900">
        {t("operations.inventory.suppliers.heading", "Suppliers")}
      </h2>
      <div className="min-w-0 flex-1" aria-hidden />
      <div className="relative w-[220px] shrink-0">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder={t("operations.inventory.suppliers.search", "Search")}
          className="h-10 pr-9"
        />
      </div>
      <Button type="button" variant="outline" className="h-10 shrink-0" onClick={props.onExport} disabled={props.exporting}>
        <Download className="mr-2 h-4 w-4" />
        {t("operations.inventory.suppliers.export", "Export")}
      </Button>
      <Button type="button" className="h-10 shrink-0" onClick={props.onCreate}>
        <Plus className="mr-2 h-4 w-4" />
        {t("operations.inventory.suppliers.create", "Create Supplier")}
      </Button>
    </div>
  );
}

export function useSuppliersSearchState() {
  const [search, setSearch] = useState("");
  return { search, setSearch };
}
