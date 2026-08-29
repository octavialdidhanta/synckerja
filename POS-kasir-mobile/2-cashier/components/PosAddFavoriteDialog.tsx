import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { catalogItemLabel } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { catalogItemInitials } from "../lib/catalogItemInitials";
import { POS_CASHIER_I18N } from "../lib/posCashierCopy";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: CustomerVisitCatalogItem[];
  favoriteIds: Set<string>;
  onSelect: (item: CustomerVisitCatalogItem) => void;
};

export function PosAddFavoriteDialog({
  open,
  onOpenChange,
  catalog,
  favoriteIds,
  onSelect,
}: Props) {
  const { t } = useAppTranslation();
  const [q, setQ] = useState("");

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog.filter((item) => {
      if (favoriteIds.has(item.id)) return false;
      if (!(item.unitPrice > 0)) return false;
      if (!needle) return true;
      return catalogItemLabel(item).toLowerCase().includes(needle);
    });
  }, [catalog, favoriteIds, q]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQ("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="flex max-h-[min(80vh,560px)] max-w-lg flex-col gap-0 overflow-hidden rounded-xl p-0 [&>button]:hidden"
        aria-describedby={undefined}
      >
        <div className="relative flex items-center justify-center border-b border-slate-100 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 border-primary text-primary"
            onClick={() => onOpenChange(false)}
          >
            {t(POS_CASHIER_I18N.favoritCancel, "Cancel")}
          </Button>
          <DialogTitle className="text-sm font-semibold">
            {t(POS_CASHIER_I18N.favoritAddTitle, "Add to Favorites")}
          </DialogTitle>
        </div>

        <div className="relative border-b border-slate-100 px-3 py-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(POS_CASHIER_I18N.favoritSearch, "Search")}
            className="h-10 pr-9"
            autoFocus
          />
          <Search className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {candidates.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-slate-400">
              {t(POS_CASHIER_I18N.favoritSearchEmpty, "No matching products.")}
            </li>
          ) : (
            candidates.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                  onClick={() => {
                    onSelect(item);
                    setQ("");
                    onOpenChange(false);
                  }}
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-sky-300 text-sm font-bold text-white">
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      catalogItemInitials(item)
                    )}
                  </div>
                  <span className="truncate text-sm font-medium text-slate-800">
                    {catalogItemLabel(item)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
