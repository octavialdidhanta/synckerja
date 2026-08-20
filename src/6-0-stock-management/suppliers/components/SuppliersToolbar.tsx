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
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{t("operations.inventory.suppliers.heading", "Suppliers")}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder={t("operations.inventory.suppliers.search", "Search")}
            className="h-9 w-48 pl-8"
          />
        </div>
        <Button type="button" variant="outline" className="h-9" onClick={props.onExport} disabled={props.exporting}>
          <Download className="mr-1 h-4 w-4" />
          {t("operations.inventory.suppliers.export", "Export")}
        </Button>
        <Button type="button" className="h-9" onClick={props.onCreate}>
          <Plus className="mr-1 h-4 w-4" />
          {t("operations.inventory.suppliers.create", "Create Supplier")}
        </Button>
      </div>
    </div>
  );
}

export function useSuppliersSearchState() {
  const [search, setSearch] = useState("");
  return { search, setSearch };
}
