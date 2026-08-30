import type { KitchenSalesTypeBucket } from "./kitchenSalesTypeBucket";

export type KitchenBoardMode =
  | { kind: "active"; salesType: "all" | KitchenSalesTypeBucket }
  | { kind: "held" }
  | { kind: "recall" }
  | { kind: "completed_today" };

export const DEFAULT_KITCHEN_BOARD_MODE: KitchenBoardMode = {
  kind: "active",
  salesType: "all",
};
