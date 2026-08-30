import type { PosTableRotation } from "../../lib/posTableTypes";

export type PosFloorFixtureType =
  | "cashier"
  | "stairs"
  | "door"
  | "kitchen"
  | "washbasin"
  | "kiosk"
  | "parking";

export const POS_FLOOR_FIXTURE_TYPES: readonly PosFloorFixtureType[] = [
  "cashier",
  "stairs",
  "door",
  "kitchen",
  "washbasin",
  "kiosk",
  "parking",
] as const;

export type PosFloorFixture = {
  id: string;
  organization_id: string;
  outlet_id: string;
  group_id: string;
  fixture_type: PosFloorFixtureType;
  name: string;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  rotation: PosTableRotation;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** Client-only: true when not yet persisted. */
  isNew?: boolean;
};

export type FixtureFootprint = { grid_w: number; grid_h: number };

export const FIXTURE_DEFAULT_FOOTPRINT: Record<
  PosFloorFixtureType,
  FixtureFootprint
> = {
  cashier: { grid_w: 2, grid_h: 1 },
  kiosk: { grid_w: 2, grid_h: 1 },
  /** Thin strip along an opening (rotate for vertical). */
  door: { grid_w: 2, grid_h: 1 },
  /** Stair run — longer depth looks like steps. */
  stairs: { grid_w: 2, grid_h: 3 },
  kitchen: { grid_w: 3, grid_h: 2 },
  washbasin: { grid_w: 1, grid_h: 1 },
  /** Free-form bay; length/width edited in dialog. */
  parking: { grid_w: 3, grid_h: 2 },
};

/** Types whose length/width should be editable when adding (not only edit). */
export const FIXTURE_SIZE_EDITABLE_ON_ADD: readonly PosFloorFixtureType[] = [
  "parking",
  "stairs",
  "kitchen",
  "cashier",
  "kiosk",
] as const;
