import {
  dimsAfterRotation,
  isSidewaysRotation,
  normalizeRotation,
  type TableBox,
} from "../../lib/tableRotation";
import type { PosTableRotation } from "../../lib/posTableTypes";
import { boxesOverlap, findFirstFreeCell } from "../../lib/tableShapeLayout";
import {
  EDGE_STRIP_FIXTURE_TYPES,
  FIXTURE_DEFAULT_FOOTPRINT,
  FIXED_CELL_FIXTURE_TYPES,
  type FixtureFootprint,
  type PosFloorFixture,
  type PosFloorFixtureType,
} from "./posFloorFixtureTypes";

export function defaultFootprintForType(
  type: PosFloorFixtureType,
): FixtureFootprint {
  return { ...FIXTURE_DEFAULT_FOOTPRINT[type] };
}

export function fixtureAxisBox(
  f: Pick<PosFloorFixture, "grid_x" | "grid_y" | "grid_w" | "grid_h">,
): TableBox {
  return { x: f.grid_x, y: f.grid_y, w: f.grid_w, h: f.grid_h };
}

export type OccupancyBox = {
  id: string;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
};

/** Place fixture avoiding tables + other fixtures. */
export function findFixtureFreeCell(
  occupied: OccupancyBox[],
  footprint: FixtureFootprint,
  excludeId?: string,
) {
  return findFirstFreeCell(occupied, footprint, excludeId);
}

export function isEdgeStripFixtureType(type: PosFloorFixtureType): boolean {
  return EDGE_STRIP_FIXTURE_TYPES.includes(type);
}

export function isFixedCellFixtureType(type: PosFloorFixtureType): boolean {
  return FIXED_CELL_FIXTURE_TYPES.includes(type);
}

export function normalizeFixedCellFootprint(): FixtureFootprint {
  return { grid_w: 1, grid_h: 1 };
}

/** Thin strip along top/left (start) or bottom/right (end) of occupied cells. */
export function edgeStripLayout(
  fixture: Pick<PosFloorFixture, "rotation" | "grid_w" | "grid_h">,
): { vertical: boolean; pinEnd: boolean } {
  const vertical =
    isSidewaysRotation(fixture.rotation) || fixture.grid_h > fixture.grid_w;
  const pinEnd = fixture.rotation === 90 || fixture.rotation === 180;
  return { vertical, pinEnd };
}

/** Keep door/wall one cell thick; length is the long axis. */
export function normalizeEdgeStripFootprint(
  grid_w: number,
  grid_h: number,
  rotation: PosTableRotation,
): FixtureFootprint {
  const w = Math.max(1, Math.floor(grid_w) || 1);
  const h = Math.max(1, Math.floor(grid_h) || 1);
  const vertical = isSidewaysRotation(rotation) || h > w;
  if (vertical) return { grid_w: 1, grid_h: Math.max(w, h) };
  return { grid_w: Math.max(w, h), grid_h: 1 };
}

export type FixtureLengthEdge = "start" | "end";

export type FixtureRect = {
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
};

/** Resize a wall along its long axis from a pointer-down snapshot. */
export function resizeFixtureAlongAxis(
  origin: Pick<
    PosFloorFixture,
    "grid_x" | "grid_y" | "grid_w" | "grid_h" | "rotation"
  >,
  edge: FixtureLengthEdge,
  cellDelta: number,
): FixtureRect {
  const { vertical } = edgeStripLayout(origin);
  if (!vertical) {
    if (edge === "end") {
      return {
        grid_x: origin.grid_x,
        grid_y: origin.grid_y,
        grid_w: Math.max(1, origin.grid_w + cellDelta),
        grid_h: 1,
      };
    }
    const nextX = origin.grid_x + cellDelta;
    const nextW = origin.grid_w - cellDelta;
    if (nextX < 0) {
      return {
        grid_x: 0,
        grid_y: origin.grid_y,
        grid_w: origin.grid_w + origin.grid_x,
        grid_h: 1,
      };
    }
    if (nextW < 1) {
      return {
        grid_x: origin.grid_x + origin.grid_w - 1,
        grid_y: origin.grid_y,
        grid_w: 1,
        grid_h: 1,
      };
    }
    return {
      grid_x: nextX,
      grid_y: origin.grid_y,
      grid_w: nextW,
      grid_h: 1,
    };
  }

  if (edge === "end") {
    return {
      grid_x: origin.grid_x,
      grid_y: origin.grid_y,
      grid_w: 1,
      grid_h: Math.max(1, origin.grid_h + cellDelta),
    };
  }
  const nextY = origin.grid_y + cellDelta;
  const nextH = origin.grid_h - cellDelta;
  if (nextY < 0) {
    return {
      grid_x: origin.grid_x,
      grid_y: 0,
      grid_w: 1,
      grid_h: origin.grid_h + origin.grid_y,
    };
  }
  if (nextH < 1) {
    return {
      grid_x: origin.grid_x,
      grid_y: origin.grid_y + origin.grid_h - 1,
      grid_w: 1,
      grid_h: 1,
    };
  }
  return {
    grid_x: origin.grid_x,
    grid_y: nextY,
    grid_w: 1,
    grid_h: nextH,
  };
}

export function applyFixtureRotation(
  fixture: PosFloorFixture,
  toRot: PosTableRotation,
  occupied: OccupancyBox[],
): { ok: true; fixture: PosFloorFixture } | { ok: false } {
  const from = normalizeRotation(fixture.rotation);
  const to = normalizeRotation(toRot);
  const dims = dimsAfterRotation(fixture.grid_w, fixture.grid_h, from, to);
  const candidate = {
    x: fixture.grid_x,
    y: fixture.grid_y,
    w: dims.grid_w,
    h: dims.grid_h,
  };
  const clash = occupied.some((o) => {
    if (o.id === fixture.id) return false;
    return boxesOverlap(candidate, {
      x: o.grid_x,
      y: o.grid_y,
      w: o.grid_w,
      h: o.grid_h,
    });
  });
  if (clash) return { ok: false };
  return {
    ok: true,
    fixture: {
      ...fixture,
      rotation: to,
      grid_w: dims.grid_w,
      grid_h: dims.grid_h,
    },
  };
}
