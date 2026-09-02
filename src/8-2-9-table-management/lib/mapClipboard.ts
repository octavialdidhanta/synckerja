import type { PosTable } from "./posTableTypes";
import type { PosFloorFixture } from "../fixtures/lib/posFloorFixtureTypes";
import {
  TABLE_MAP_MIN_COLS,
  boxesOverlap,
  findFirstFreeCell,
  type TableFootprint,
} from "./tableShapeLayout";

export type MapClipboardItem =
  | { kind: "table"; source: PosTable }
  | { kind: "fixture"; source: PosFloorFixture };

export type OccupiedCell = {
  id: string;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
};

/** Next free label: "Kasir" → "Kasir 2", "Kasir 2" → "Kasir 3". */
export function nextUniqueMapName(
  name: string,
  existingNames: string[],
): string {
  const base = name.trim() || "Item";
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  const stem = base.replace(/\s+\d+$/, "").trim() || base;
  let n = 2;
  while (taken.has(`${stem} ${n}`.toLowerCase())) n += 1;
  return `${stem} ${n}`;
}

function overlapsOccupied(
  occupied: OccupiedCell[],
  x: number,
  y: number,
  footprint: TableFootprint,
): boolean {
  const candidate = { x, y, w: footprint.grid_w, h: footprint.grid_h };
  return occupied.some((o) =>
    boxesOverlap(candidate, {
      x: o.grid_x,
      y: o.grid_y,
      w: o.grid_w,
      h: o.grid_h,
    }),
  );
}

/** Prefer one cell right of the source, then below, then first free cell. */
export function findPasteCell(
  occupied: OccupiedCell[],
  footprint: TableFootprint,
  source: { grid_x: number; grid_y: number; grid_w: number; grid_h: number },
): { grid_x: number; grid_y: number } {
  const tries = [
    { x: source.grid_x + source.grid_w, y: source.grid_y },
    { x: source.grid_x, y: source.grid_y + source.grid_h },
    { x: source.grid_x + 1, y: source.grid_y + source.grid_h },
  ];
  for (const tryPos of tries) {
    if (tryPos.x < 0 || tryPos.y < 0) continue;
    if (!overlapsOccupied(occupied, tryPos.x, tryPos.y, footprint)) {
      return { grid_x: tryPos.x, grid_y: tryPos.y };
    }
  }
  const maxX = occupied.reduce(
    (m, o) => Math.max(m, o.grid_x + o.grid_w),
    TABLE_MAP_MIN_COLS,
  );
  const maxY = occupied.reduce(
    (m, o) => Math.max(m, o.grid_y + o.grid_h),
    8,
  );
  return findFirstFreeCell(
    occupied,
    footprint,
    undefined,
    Math.max(TABLE_MAP_MIN_COLS, maxX + 2),
    Math.max(40, maxY + 2),
  );
}
