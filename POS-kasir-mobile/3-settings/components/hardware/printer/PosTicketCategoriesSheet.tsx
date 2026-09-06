import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useCatalogProductCategories } from "@/8-2-1-default-prices/categories/hooks/useCatalogProductCategories";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";
import type { PosSavedPrinter } from "../../../lib/printer/posPrinterTypes";
import { PosPrinterPageChrome } from "./PosPrinterPageChrome";

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
  const title = t(POS_SETTINGS_I18N.printerTicketCategoriesTitle, "INCLUDE IN ORDER TICKET");

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
    <PosPrinterPageChrome
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      zClassName="z-[90]"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
        <div className="flex-shrink-0 border-b border-slate-200 bg-white">
          <div className={cn(POS_PANEL.header, "flex-row space-y-0 border-b-0 text-left")}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={POS_PANEL.headerBack}
              aria-label={t(POS_SETTINGS_I18N.back, "Back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className={cn(POS_PANEL.headerTitle, "leading-none")}>{title}</h1>
          </div>
        </div>
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={POS_PANEL.body}>
            {isLoading ? (
              <div className="space-y-3" aria-busy>
                <div className={cn(POS_PANEL.card, "h-12 animate-pulse bg-slate-200")} />
                <div className={cn(POS_PANEL.card, "h-12 animate-pulse bg-slate-200")} />
              </div>
            ) : categories.length === 0 ? (
              <p className="px-0.5 py-6 text-sm text-slate-400">—</p>
            ) : (
              <div className={POS_PANEL.card}>
                {categories.map((cat) => (
                  <div key={cat.id} className={POS_PANEL.row}>
                    <span className={POS_PANEL.rowLabel}>{cat.name}</span>
                    <Switch
                      checked={isOn(cat.id)}
                      onCheckedChange={(v) => toggle(cat.id, v)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PosPrinterPageChrome>
  );
}
