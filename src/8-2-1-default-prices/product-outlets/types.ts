import type { CatalogPosStatus } from "../lib/catalogKind";

export type ProductOutletOverride = {
  unit_price: number | null;
  pos_status: CatalogPosStatus | null;
};

export type CatalogProductOutletLink = {
  outlet_id: string;
  unit_price: number | null;
  pos_status: CatalogPosStatus | null;
};
