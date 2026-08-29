import type { PosTable, PosTableRotation, PosTableShape } from "./posTableTypes";
import { boxesOverlap } from "./tableShapeLayout";

export type TableBox = { x: number; y: number; w: number; h: number };

export function normalizeRotation(n: number): PosTableRotation {
  const stepped = Math.round(Number(n) / 90) * 90;
  const r = ((stepped % 360) + 360) % 360;
  if (r === 90 || r === 180 || r === 270) return r;
  return 0;
}

/** Clockwise by `delta` degrees (default +90). */
export function nextRotation(
  current: PosTableRotation,
  delta = 90,
): PosTableRotation {
  return normalizeRotation(current + delta);
}

/** True when long axis is vertical in the axis-aligned grid (chairs on left/right). */
export function isSidewaysRotation(rotation: PosTableRotation): boolean {
  const r = normalizeRotation(rotation);
  return r === 90 || r === 270;
}

/**
 * Axis-aligned cell size after changing rotation.
 * Odd 90° steps swap width/height; even steps keep dims.
 */
export function dimsAfterRotation(
  grid_w: number,
  grid_h: number,
  fromRot: PosTableRotation,
  toRot: PosTableRotation,
): { grid_w: number; grid_h: number } {
  const from = normalizeRotation(fromRot);
  const to = normalizeRotation(toRot);
  const steps = (((to - from) / 90) % 4 + 4) % 4;
  if (steps % 2 === 1) return { grid_w: grid_h, grid_h: grid_w };
  return { grid_w, grid_h };
}

/**
 * Stored `grid_w`/`grid_h` are always the axis-aligned footprint
 * (swapped on rotate). Prefer these for collision / bounds.
 */
export function axisAlignedFootprint(
  table: Pick<PosTable, "grid_w" | "grid_h" | "rotation">,
): { grid_w: number; grid_h: number } {
  return { grid_w: table.grid_w, grid_h: table.grid_h };
}

export function axisAlignedBox(
  table: Pick<PosTable, "grid_x" | "grid_y" | "grid_w" | "grid_h" | "rotation">,
): TableBox {
  const fp = axisAlignedFootprint(table);
  return { x: table.grid_x, y: table.grid_y, w: fp.grid_w, h: fp.grid_h };
}

/**
 * Legacy rows may keep native 2×1 dims with rotation=90 (CSS-only era).
 * Normalize so footprint matches orientation for grid-aligned layout.
 */
export function normalizeTableLayoutForRotation<
  T extends {
    shape: PosTableShape;
    grid_w: number;
    grid_h: number;
    rotation: PosTableRotation;
  },
>(table: T): T {
  const rot = normalizeRotation(table.rotation);
  if (
    (table.shape === "rectangle" || table.shape === "one_sided") &&
    (rot === 90 || rot === 270) &&
    table.grid_w > table.grid_h
  ) {
    return { ...table, grid_w: table.grid_h, grid_h: table.grid_w };
  }
  return table;
}

type RotatableTable = Pick<
  PosTable,
  "id" | "grid_x" | "grid_y" | "grid_w" | "grid_h" | "rotation"
>;

/**
 * Apply a new rotation and swap `grid_w`/`grid_h` on 90°/270° steps so the
 * table stays axis-aligned inside grid cells (no CSS-rotate spill).
 */
export function applyTableRotation(
  table: RotatableTable,
  toRot: PosTableRotation,
  others: RotatableTable[],
):
  | { ok: true; table: RotatableTable }
  | { ok: false; reason: "overlap" } {
  const next = normalizeRotation(toRot);
  const from = normalizeRotation(table.rotation);
  if (next === from) {
    return { ok: true, table: { ...table, rotation: next } };
  }

  const dims = dimsAfterRotation(table.grid_w, table.grid_h, from, next);
  const candidate: TableBox = {
    x: table.grid_x,
    y: table.grid_y,
    w: dims.grid_w,
    h: dims.grid_h,
  };

  if (candidate.x < 0 || candidate.y < 0) {
    return { ok: false, reason: "overlap" };
  }

  const clash = others.some((other) => {
    if (other.id === table.id) return false;
    return boxesOverlap(candidate, axisAlignedBox(other));
  });
  if (clash) return { ok: false, reason: "overlap" };

  return {
    ok: true,
    table: {
      ...table,
      rotation: next,
      grid_w: dims.grid_w,
      grid_h: dims.grid_h,
    },
  };
}
