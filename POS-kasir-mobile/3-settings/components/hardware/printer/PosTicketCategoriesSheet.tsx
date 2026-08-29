import { useMemo } from "react";
import { useCatalogProductCategories } from "@/8-2-1-default-prices/categories/hooks/useCatalogProductCategories";
import { Switch } from "@/shared/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";
import type { PosSavedPrinter } from "../../../lib/printer/posPrinterTypes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletId: string;
  printer: PosSavedPrinter | null;
  onChange: (printer: PosSavedPrinter) => void;
};

export function PosTicketCategoriesSheet({
  open,
  onOpenChange,
  outletId,
  printer,
  onChange,
}: Props) {
  const { t } = useAppTranslation();
  const { rows, isLoading } = useCatalogProductCategories();

  const categories = useMemo(
    () =>
      rows
        .filter((r) => r.is_active && r.outlet_ids.includes(outletId))
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [rows, outletId],
  );

  const isOn = (categoryId: string): boolean => {
    if (!printer) return true;
    if (printer.categoryIdsForTicket === "all") return true;
    return printer.categoryIdsForTicket.includes(categoryId);
  };

  const toggle = (categoryId: string, enabled: boolean) => {
    if (!printer) return;
    const allIds = categories.map((c) => c.id);
    let nextIds: string[];
    if (printer.categoryIdsForTicket === "all") {
      nextIds = enabled ? allIds : allIds.filter((id) => id !== categoryId);
    } else {
      nextIds = enabled
        ? [...new Set([...printer.categoryIdsForTicket, categoryId])]
        : printer.categoryIdsForTicket.filter((id) => id !== categoryId);
    }
    const categoryIdsForTicket =
      nextIds.length === allIds.length && allIds.length > 0 ? "all" : nextIds;
    onChange({ ...printer, categoryIdsForTicket });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle className="text-sm font-bold uppercase tracking-wide">
            {t(POS_SETTINGS_I18N.printerTicketCategoriesTitle, "INCLUDE IN ORDER TICKET")}
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {isLoading ? (
            <div className="space-y-3 py-4" aria-busy>
              <div className="h-10 animate-pulse rounded bg-slate-100" />
              <div className="h-10 animate-pulse rounded bg-slate-100" />
            </div>
          ) : categories.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">—</p>
          ) : (
            <ul>
              {categories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 py-3.5 last:border-b-0"
                >
                  <span className="text-sm text-slate-900">{cat.name}</span>
                  <Switch
                    checked={isOn(cat.id)}
                    onCheckedChange={(v) => toggle(cat.id, v)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
