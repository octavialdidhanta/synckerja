import type { PosTableShape } from "./posTableTypes";

export const TABLE_MAP_CELL_PX = 56;
/** One-sided tables occupy half a cell on the thin axis (counter / bar). */
export const ONE_SIDED_THIN_RATIO = 0.5;
export const TABLE_MAP_MIN_COLS = 12;
export const TABLE_MAP_MIN_ROWS = 8;

export type TableFootprint = { grid_w: number; grid_h: number };

/** Clamp / normalize pax for a shape. Square always 2. */
export function normalizePaxForShape(shape: PosTableShape, pax: number): number {
  const n = Math.max(1, Math.floor(Number.isFinite(pax) ? pax : 1));
  if (shape === "square") return 2;
  if (shape === "circle") return Math.min(12, Math.max(1, n));
  return Math.min(20, Math.max(shape === "rectangle" ? 2 : 1, n));
}

export function defaultPaxForShape(shape: PosTableShape): number {
  if (shape === "square") return 2;
  if (shape === "circle") return 4;
  if (shape === "rectangle") return 4;
  return 3;
}

/** Footprint in grid cells from shape + pax. */
export function footprintForShape(shape: PosTableShape, pax: number): TableFootprint {
  const seats = normalizePaxForShape(shape, pax);
  if (shape === "square" || shape === "circle") {
    return { grid_w: 1, grid_h: 1 };
  }
  if (shape === "rectangle") {
    return { grid_w: Math.max(2, Math.ceil(seats / 2)), grid_h: 1 };
  }
  // one_sided: one seat per cell along length
  return { grid_w: Math.max(1, seats), grid_h: 1 };
}

export function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export function findFirstFreeCell(
  tables: Array<{ id: string; grid_x: number; grid_y: number; grid_w: number; grid_h: number }>,
  footprint: TableFootprint,
  excludeId?: string,
  maxCols = TABLE_MAP_MIN_COLS,
  maxRows = 40,
): { grid_x: number; grid_y: number } {
  for (let y = 0; y < maxRows; y += 1) {
    for (let x = 0; x < maxCols; x += 1) {
      const candidate = { x, y, w: footprint.grid_w, h: footprint.grid_h };
      const hit = tables.some((t) => {
        if (excludeId && t.id === excludeId) return false;
        return boxesOverlap(candidate, {
          x: t.grid_x,
          y: t.grid_y,
          w: t.grid_w,
          h: t.grid_h,
        });
      });
      if (!hit) return { grid_x: x, grid_y: y };
    }
  }
  return { grid_x: 0, grid_y: maxRows };
}
