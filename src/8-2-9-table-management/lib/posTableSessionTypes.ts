import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

export type PosTableSessionStatus = "open" | "paid" | "cancelled";

export type PosTableSession = {
  id: string;
  organization_id: string;
  outlet_id: string;
  group_id: string | null;
  pos_table_id: string | null;
  table_name: string;
  pax: number;
  seated_at: string;
  closed_at: string | null;
  status: PosTableSessionStatus;
  opened_by: string | null;
  closed_by: string | null;
  waiter_id: string | null;
  sales_activity_id: string | null;
  cart_snapshot: CustomerVisitCartLine[];
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type PosTableSessionUpsertPayload = {
  outletId: string;
  /** Null for walk-in open bills. */
  groupId: string | null;
  /** Null for walk-in open bills. */
  posTableId: string | null;
  tableName: string;
  pax: number;
  cartLines: CustomerVisitCartLine[];
  /** Assigned waiter (shift opener). */
  waiterId?: string | null;
};
