import { useMemo } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosFloorFixture } from "@/8-2-9-table-management/fixtures";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import {
  computeTableOccupancy,
  type TableOccupancy,
} from "@/8-2-9-table-management/sessions";
import {
  TABLE_MAP_CELL_PX,
  TABLE_MAP_MIN_COLS,
  TABLE_MAP_MIN_ROWS,
} from "@/8-2-9-table-management/lib/tableShapeLayout";
import { PosTableMapFixtureNode } from "@/pos-mobile/5-table-map/components/PosTableMapFixtureNode";
import { PosTableMapTableNode } from "@/pos-mobile/5-table-map/components/PosTableMapTableNode";
import { POS_SELECT_TABLE_I18N } from "../../lib/posSelectTableCopy";

const EMPTY_SESSIONS_BY_TABLE = new Map<string, PosTableSession[]>();

type Props = {
  tables: PosTable[];
  fixtures: PosFloorFixture[];
  sessionsByTableId?: Map<string, PosTableSession[]> | null;
  selectedTableId: string | null;
  loading?: boolean;
  onSelect: (table: PosTable, occupancy: TableOccupancy) => void;
};

/** Select-table floor layout with multi-bill occupancy states. */
export function PosSelectTableMap({
  tables,
  fixtures,
  sessionsByTableId,
  selectedTableId,
  loading,
  onSelect,
}: Props) {
  const { t } = useAppTranslation();
  const sessionMap = sessionsByTableId ?? EMPTY_SESSIONS_BY_TABLE;
  const tableList = tables ?? [];
  const fixtureList = fixtures ?? [];

  const bounds = useMemo(() => {
    let maxX = TABLE_MAP_MIN_COLS;
    let maxY = TABLE_MAP_MIN_ROWS;
    for (const table of tableList) {
      maxX = Math.max(maxX, table.grid_x + table.grid_w + 2);
      maxY = Math.max(maxY, table.grid_y + table.grid_h + 2);
    }
    for (const fixture of fixtureList) {
      maxX = Math.max(maxX, fixture.grid_x + fixture.grid_w + 2);
      maxY = Math.max(maxY, fixture.grid_y + fixture.grid_h + 2);
    }
    return { cols: maxX, rows: maxY };
  }, [fixtureList, tableList]);

  const widthPx = bounds.cols * TABLE_MAP_CELL_PX;
  const heightPx = bounds.rows * TABLE_MAP_CELL_PX;

  if (loading) {
    return (
      <div className="flex min-h-[240px] flex-1 items-center justify-center p-4">
        <div className="h-28 w-full max-w-md animate-pulse rounded-lg bg-slate-200/80" aria-hidden />
      </div>
    );
  }

  if (tableList.length === 0 && fixtureList.length === 0) {
    return (
      <p className="px-6 py-16 text-center text-sm text-slate-400">
        {t(POS_SELECT_TABLE_I18N.emptyGroup, "No tables in this group.")}
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-slate-100/80 p-3">
      <div
        className="relative mx-auto rounded-lg border border-slate-200 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[length:56px_56px] shadow-inner"
        style={{ width: widthPx, height: heightPx, minWidth: widthPx, minHeight: heightPx }}
      >
        {fixtureList.map((fixture) => (
          <PosTableMapFixtureNode key={fixture.id} fixture={fixture} />
        ))}
        {tableList.map((table) => {
          const sessions = sessionMap.get(table.id) ?? [];
          const occupancy = computeTableOccupancy(sessions, table.pax);
          const label =
            occupancy.state === "empty"
              ? `${table.pax} pax`
              : `${occupancy.usedPax}/${occupancy.capacity}`;
          return (
            <PosTableMapTableNode
              key={table.id}
              table={table}
              selected={table.id === selectedTableId}
              occupancyState={occupancy.state}
              occupancyLabel={label}
              onSelect={() => onSelect(table, occupancy)}
            />
          );
        })}
      </div>
    </div>
  );
}
