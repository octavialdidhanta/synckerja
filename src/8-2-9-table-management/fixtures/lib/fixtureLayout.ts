import {
  dimsAfterRotation,
  normalizeRotation,
  type TableBox,
} from "../../lib/tableRotation";
import type { PosTableRotation } from "../../lib/posTableTypes";
import { boxesOverlap, findFirstFreeCell } from "../../lib/tableShapeLayout";
import {
  FIXTURE_DEFAULT_FOOTPRINT,
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
