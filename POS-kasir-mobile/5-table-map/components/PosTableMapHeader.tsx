import { ListOrdered } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_TABLE_MAP_I18N } from "../lib/posTableMapCopy";
import { PosTableMapLegend } from "./PosTableMapLegend";

type Props = {
  showLegend?: boolean;
  occupiedCount?: number;
  onOpenBillList?: () => void;
};

/** Slim Table Map header: title + Bill List (top-right) + Vacant/Occupied legend. */
export function PosTableMapHeader({
  showLegend = true,
  occupiedCount = 0,
  onOpenBillList,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <header className="flex-shrink-0 border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h1 className="text-base font-semibold text-slate-900">
          {t(POS_TABLE_MAP_I18N.title, "Table Map")}
        </h1>
        {onOpenBillList ? (
          <button
            type="button"
            onClick={onOpenBillList}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary shadow-sm transition-colors",
              "hover:border-primary/40 hover:bg-primary/5",
            )}
            aria-label={t(POS_TABLE_MAP_I18N.billListTitle, "Bill List")}
          >
            <ListOrdered className="h-4 w-4" />
            <span>{t(POS_TABLE_MAP_I18N.billListTitle, "Bill List")}</span>
            {occupiedCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                {occupiedCount > 99 ? "99+" : occupiedCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
      {showLegend ? <PosTableMapLegend /> : null}
    </header>
  );
}
