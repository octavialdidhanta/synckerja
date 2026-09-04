import { useMemo } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosFloorFixture } from "@/8-2-9-table-management/fixtures";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import { computeTableOccupancy } from "@/8-2-9-table-management/sessions";
import {
  TABLE_MAP_CELL_PX,
  TABLE_MAP_MIN_COLS,
  TABLE_MAP_MIN_ROWS,
} from "@/8-2-9-table-management/lib/tableShapeLayout";
import { formatPosTableDuration } from "../lib/formatPosTableDuration";
import { POS_TABLE_MAP_I18N } from "../lib/posTableMapCopy";
import { PosTableMapFixtureNode } from "./PosTableMapFixtureNode";
import { PosTableMapTableNode } from "./PosTableMapTableNode";

const EMPTY_SESSIONS_BY_TABLE = new Map<string, PosTableSession[]>();

type Props = {
  tables: PosTable[];
  fixtures?: PosFloorFixture[];
  selectedId: string | null;
  sessionsByTableId?: Map<string, PosTableSession[]> | null;
  nowMs: number;
  onSelect: (table: PosTable) => void;
  empty?: boolean;
  loading?: boolean;
};

/** Read-only floor plan canvas (no drag / edit). */
export function PosTableMapCanvas({
  tables,
  fixtures = [],
  selectedId,
  sessionsByTableId,
  nowMs,
  onSelect,
  empty,
  loading,
}: Props) {
  const { t } = useAppTranslation();
  const sessionMap = sessionsByTableId ?? EMPTY_SESSIONS_BY_TABLE;

  const bounds = useMemo(() => {
    let maxX = TABLE_MAP_MIN_COLS;
    let maxY = TABLE_MAP_MIN_ROWS;
    for (const table of tables) {
      maxX = Math.max(maxX, table.grid_x + table.grid_w + 2);
      maxY = Math.max(maxY, table.grid_y + table.grid_h + 2);
    }
    for (const fixture of fixtures) {
      maxX = Math.max(maxX, fixture.grid_x + fixture.grid_w + 2);
      maxY = Math.max(maxY, fixture.grid_y + fixture.grid_h + 2);
    }
    return { cols: maxX, rows: maxY };
  }, [fixtures, tables]);

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

  if (empty && fixtures.length === 0) {
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
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain bg-slate-100/80 p-3 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] scrollbar-hide nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        className="relative rounded-lg border border-slate-200 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[length:56px_56px] shadow-inner"
        style={{ width: widthPx, height: heightPx, minWidth: widthPx, minHeight: heightPx }}
      >
        {fixtures.map((fixture) => (
          <PosTableMapFixtureNode key={fixture.id} fixture={fixture} />
        ))}
        {tables.map((table) => {
          const sessions = sessionMap.get(table.id) ?? [];
          const occupancy = computeTableOccupancy(sessions, table.pax);
          const oldest = sessions[0] ?? null;
          const label =
            occupancy.state === "empty"
              ? `${table.pax} pax`
              : `${occupancy.usedPax}/${occupancy.capacity}`;
          return (
            <PosTableMapTableNode
              key={table.id}
              table={table}
              selected={table.id === selectedId}
              occupancyState={occupancy.state}
              occupancyLabel={label}
              durationLabel={
                oldest && occupancy.state !== "empty"
                  ? formatPosTableDuration(oldest.seated_at, nowMs)
                  : null
              }
              onSelect={() => onSelect(table)}
            />
          );
        })}
      </div>
    </div>
  );
}
