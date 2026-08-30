export type PosKitchenTicketStatus =
  | "new"
  | "in_progress"
  | "ready"
  | "done"
  | "void";

export type PosKitchenTicketLine = {
  id: string;
  ticket_id: string;
  line_fingerprint: string;
  display_name: string;
  modifiers_text: string | null;
  quantity: number;
  sort_index: number;
  is_done: boolean;
  created_at: string;
};

export type PosKitchenTicket = {
  id: string;
  organization_id: string;
  outlet_id: string;
  session_id: string;
  pos_table_id: string | null;
  table_name: string;
  customer_name: string | null;
  sales_type_id: string | null;
  sales_type_label: string | null;
  status: PosKitchenTicketStatus;
  is_held: boolean;
  held_at: string | null;
  pause_ms: number;
  /** Set after restore from done: recalled | reverted. */
  restore_marker: "recalled" | "reverted" | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  lines: PosKitchenTicketLine[];
};

export type PosKitchenTicketLineInsert = {
  line_fingerprint: string;
  display_name: string;
  modifiers_text: string | null;
  quantity: number;
  sort_index: number;
};

export const POS_KITCHEN_ACTIVE_STATUSES: readonly PosKitchenTicketStatus[] = [
  "new",
  "in_progress",
  "ready",
] as const;

export const POS_KITCHEN_TICKETS_QUERY_KEY = "pos-kitchen-tickets";
export const POS_KITCHEN_RECALL_QUERY_KEY = "pos-kitchen-recall";
export const POS_KITCHEN_COMPLETED_TODAY_QUERY_KEY = "pos-kitchen-completed-today";
