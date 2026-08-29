export type PosSessionStockCommit = {
  id: string;
  organization_id: string;
  outlet_id: string;
  session_id: string;
  line_fingerprint: string;
  line_index: number;
  committed_qty: number;
  last_reference_id: string;
  last_committed_at: string;
  created_at: string;
  updated_at: string;
};

export type PosOutletStockSettings = {
  outlet_id: string;
  organization_id: string;
  stock_commit_point: "pay" | "kitchen" | "fulfillment";
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_POS_OUTLET_STOCK_SETTINGS = {
  stock_commit_point: "pay" as const,
};
