import type { InventorySummaryKindFilter } from "@/6-0-stock-management/summary/types";

export type TransferKindFilter = InventorySummaryKindFilter;

export type StockTransferStatus =
  | "pending_approval"
  | "approved"
  | "shipped"
  | "completed"
  | "cancelled";

export type StockTransferStatusFilter = "all" | StockTransferStatus;

export type StockTransferListRow = {
  id: string;
  orderNumber: string;
  fromOutletId: string;
  fromOutletName: string;
  toOutletId: string;
  toOutletName: string;
  itemKind: "product" | "ingredient";
  status: StockTransferStatus;
  lineCount: number;
  totalQty: number;
  occurredAt: string;
  note: string | null;
};

export type StockTransferLine = {
  id: string;
  productId: string | null;
  variantId: string | null;
  ingredientId: string | null;
  name: string;
  qty: number;
  unit: string | null;
  inStockFrom: number;
};

export type StockTransferMovement = {
  id: string;
  outletId: string;
  outletName: string;
  qtyDelta: number;
  qtyAfter: number;
  occurredAt: string;
  note: string | null;
  actorName: string;
  direction: "out" | "in";
};

export type StockTransferDetail = StockTransferListRow & {
  lines: StockTransferLine[];
  movements: StockTransferMovement[];
  events?: StockTransferEvent[];
};

export type StockTransferEvent = {
  id: string;
  eventType: "created" | "approved" | "shipped" | "fulfilled" | "cancelled";
  actorName: string;
  comment: string | null;
  occurredAt: string;
};

export type StockTransferLineDraft = {
  productId?: string;
  variantId?: string | null;
  ingredientId?: string;
  nameSnapshot: string;
  qty: number;
  inStock: number;
  unitSnapshot?: string;
};
