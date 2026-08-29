import { useMemo } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import {
  TABLE_MAP_CELL_PX,
  TABLE_MAP_MIN_COLS,
  TABLE_MAP_MIN_ROWS,
} from "@/8-2-9-table-management/lib/tableShapeLayout";
import { formatPosTableDuration } from "../lib/formatPosTableDuration";
import { POS_TABLE_MAP_I18N } from "../lib/posTableMapCopy";
import { PosTableMapTableNode } from "./PosTableMapTableNode";

type Props = {
  tables: PosTable[];
  selectedId: string | null;
  sessionsByTableId: Map<string, PosTableSession>;
  nowMs: number;
  onSelect: (table: PosTable, session: PosTableSession | null) => void;
  empty?: boolean;
  loading?: boolean;
};

/** Read-only floor plan canvas (no drag / edit). */
export function PosTableMapCanvas({
  tables,
  selectedId,
  sessionsByTableId,
  nowMs,
  onSelect,
  empty,
  loading,
}: Props) {
  const { t } = useAppTranslation();

  const bounds = useMemo(() => {
    let maxX = TABLE_MAP_MIN_COLS;
    let maxY = TABLE_MAP_MIN_ROWS;
    for (const table of tables) {
      maxX = Math.max(maxX, table.grid_x + table.grid_w + 2);
      maxY = Math.max(maxY, table.grid_y + table.grid_h + 2);
    }
    return { cols: maxX, rows: maxY };
  }, [tables]);

  const widthPx = bounds.cols * TABLE_MAP_CELL_PX;
  const heightPx = bounds.rows * TABLE_MAP_CELL_PX;

  if (loading) {
    return (
      <div
        className="flex flex-1 items-center justify-center text-sm text-slate-500"
        aria-label={t(POS_TABLE_MAP_I18N.loading, "Loading table map…")}
      >
        <span className="sr-only">{t(POS_TABLE_MAP_I18N.loading, "Loading table map…")}</span>
        <div className="h-24 w-full max-w-md animate-pulse rounded-lg bg-slate-200/80" aria-hidden />
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium text-slate-700">
          {t(POS_TABLE_MAP_I18N.emptyMap, "No tables on this floor plan yet.")}
        </p>
        <p className="max-w-sm text-xs text-slate-500">
          {t(
            POS_TABLE_MAP_I18N.setupHint,
            "Set up the floor plan in Office → Table Management.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-slate-100/80 p-3">
      <div
        className="relative mx-auto rounded-lg border border-slate-200 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[length:56px_56px] shadow-inner"
        style={{ width: widthPx, height: heightPx, minWidth: widthPx, minHeight: heightPx }}
      >
        {tables.map((table) => {
          const session = sessionsByTableId.get(table.id) ?? null;
          const occupied = Boolean(session);
          return (
            <PosTableMapTableNode
              key={table.id}
              table={table}
              selected={table.id === selectedId}
              occupied={occupied}
              durationLabel={
                session ? formatPosTableDuration(session.seated_at, nowMs) : null
              }
              onSelect={() => onSelect(table, session)}
            />
          );
        })}
      </div>
    </div>
  );
}
