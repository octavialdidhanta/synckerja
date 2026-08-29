import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_TABLE_MAP_I18N } from "../lib/posTableMapCopy";

export function PosTableMapLegend() {
  const { t } = useAppTranslation();
  return (
    <div className="flex flex-shrink-0 items-center gap-4 px-3 py-2 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border border-emerald-600 bg-emerald-100" aria-hidden />
        {t(POS_TABLE_MAP_I18N.legendVacant, "Vacant")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border border-orange-600 bg-orange-100" aria-hidden />
        {t(POS_TABLE_MAP_I18N.legendOccupied, "Occupied")}
      </span>
    </div>
  );
}
