import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { catalogItemLabel } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";
import { PosCashierProductGrid } from "../PosCashierProductGrid";

type Props = {
  title: string;
  items: CustomerVisitCatalogItem[];
  onBack: () => void;
  onAddItem: (item: CustomerVisitCatalogItem) => void;
  disabled?: boolean;
  emptyLabel?: string;
  /** Catalog product IDs with base recipe that cannot serve 1 unit. */
  recipeOutOfStockIds?: Set<string>;
  recipeOutOfStockReasons?: Map<
    string,
    import("@/stock-management/recipe-availability").RecipeStockBlocker[]
  >;
};

export function PosLibraryProductPane({
  title,
  items,
  onBack,
  onAddItem,
  disabled,
  emptyLabel,
  recipeOutOfStockIds,
  recipeOutOfStockReasons,
}: Props) {
  const { t } = useAppTranslation();
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => catalogItemLabel(item).toLowerCase().includes(needle));
  }, [items, query]);

  useEffect(() => {
    setPageIndex(0);
  }, [query, items]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="relative flex-shrink-0 border-b border-slate-100 px-3 py-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(POS_CASHIER_I18N.librarySearch, "Search")}
          className="h-10 pr-9"
        />
        <Search className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      <div className="relative flex flex-shrink-0 items-center justify-center border-b border-slate-100 px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 text-slate-600"
          aria-label={t(POS_CASHIER_I18N.libraryBack, "Back")}
          onClick={onBack}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="max-w-[70%] truncate text-base font-semibold text-slate-900">{title}</h2>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
          {emptyLabel ?? t(POS_CASHIER_I18N.libraryEmptyProducts, "No products found.")}
        </div>
      ) : (
        <PosCashierProductGrid
          items={filtered}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          onAddItem={onAddItem}
          disabled={disabled}
          recipeOutOfStockIds={recipeOutOfStockIds}
          recipeOutOfStockReasons={recipeOutOfStockReasons}
        />
      )}
    </div>
  );
}
