import { Lock } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import { POS_SELECT_TABLE_I18N } from "../../lib/posSelectTableCopy";

type Props = {
  tables: PosTable[];
  sessionsByTableId: Map<string, PosTableSession>;
  selectedTableId: string | null;
  /** Occupied table that may still be selected (current bill being updated). */
  allowOccupiedTableId?: string | null;
  onSelect: (table: PosTable) => void;
};

export function PosSelectTableGrid({
  tables,
  sessionsByTableId,
  selectedTableId,
  allowOccupiedTableId = null,
  onSelect,
}: Props) {
  const { t } = useAppTranslation();

  if (tables.length === 0) {
    return (
      <p className="px-6 py-16 text-center text-sm text-slate-400">
        {t(POS_SELECT_TABLE_I18N.emptyGroup, "No tables in this group.")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {tables.map((table) => {
        const session = sessionsByTableId.get(table.id);
        const occupied = Boolean(session) && table.id !== allowOccupiedTableId;
        const selected = selectedTableId === table.id;
        return (
          <button
            key={table.id}
            type="button"
            disabled={occupied}
            onClick={() => {
              if (!occupied) onSelect(table);
            }}
            className={cn(
              "relative flex aspect-square flex-col items-center justify-center rounded-xl border-2 bg-white px-2 text-center transition-colors",
              occupied && "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400",
              !occupied && !selected && "border-slate-200 hover:border-primary/50",
              selected && "border-primary bg-primary/5 ring-2 ring-primary/30",
            )}
          >
            {occupied ? (
              <>
                <Lock className="mb-1 h-5 w-5" aria-hidden />
                <span className="text-xs font-semibold">{table.name}</span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide">
                  {t(POS_SELECT_TABLE_I18N.occupied, "Occupied")}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-900">{table.name}</span>
                <span className="mt-1 text-xs text-slate-500">0/{table.pax}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
