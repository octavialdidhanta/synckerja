import type { InventorySummaryKindFilter } from "@/6-0-stock-management/summary/types";
import type { PoFinanceStatus, PoLinkedPurchaseRequest } from "./finance/poFinanceStatus";

export type PurchaseOrderKindFilter = InventorySummaryKindFilter;

export type PurchaseOrderStatus = "waiting" | "completed" | "cancelled";

export type PurchaseOrderStatusFilter = PurchaseOrderStatus | "all";

export type { PoFinanceStatus, PoLinkedPurchaseRequest };

export type PurchaseOrderListRow = {
  id: string;
  orderNumber: string;
  outletId: string;
  outletName: string;
  supplierId: string | null;
  supplierName: string;
  itemKind: "product" | "ingredient";
  status: PurchaseOrderStatus;
  totalValue: number;
  occurredAt: string;
  note: string | null;
  finance: PoLinkedPurchaseRequest | null;
};

export type PurchaseOrderLine = {
  id: string;
  productId: string | null;
  variantId: string | null;
  ingredientId: string | null;
  name: string;
  qty: number;
  unitCost: number;
  subtotal: number;
  inStock: number;
};

export type PurchaseOrderEvent = {
  id: string;
  eventType: "created" | "fulfilled" | "cancelled" | "edited" | "note_updated";
  actorName: string;
  comment: string | null;
  occurredAt: string;
};

export type PurchaseOrderDetail = PurchaseOrderListRow & {
  supplier: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
  lines: PurchaseOrderLine[];
  events: PurchaseOrderEvent[];
  fulfilledAt: string | null;
  cancelledAt: string | null;
};

export type PurchaseOrderLineDraft = {
  productId?: string;
  variantId?: string | null;
  ingredientId?: string;
  nameSnapshot: string;
  qty: number;
  unitCost: number;
  inStock: number;
};
