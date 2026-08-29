export type PosTableShape = "circle" | "square" | "rectangle" | "one_sided";

export type PosTableRotation = 0 | 90 | 180 | 270;

export type PosTable = {
  id: string;
  organization_id: string;
  outlet_id: string;
  group_id: string;
  name: string;
  shape: PosTableShape;
  pax: number;
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

export type PosTableDraft = Omit<
  PosTable,
  "organization_id" | "outlet_id" | "group_id" | "is_deleted" | "deleted_at" | "created_at" | "updated_at"
> & {
  organization_id?: string;
  outlet_id?: string;
  group_id?: string;
};

export const POS_TABLE_SHAPES: PosTableShape[] = [
  "circle",
  "square",
  "rectangle",
  "one_sided",
];
