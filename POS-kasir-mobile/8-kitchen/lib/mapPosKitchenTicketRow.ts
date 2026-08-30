import type {
  PosKitchenTicket,
  PosKitchenTicketLine,
  PosKitchenTicketStatus,
} from "./posKitchenTypes";

export const POS_KITCHEN_TICKET_SELECT = `
  id,
  organization_id,
  outlet_id,
  session_id,
  pos_table_id,
  table_name,
  customer_name,
  sales_type_id,
  sales_type_label,
  status,
  is_held,
  held_at,
  pause_ms,
  restore_marker,
  created_by,
  completed_at,
  created_at,
  updated_at,
  pos_kitchen_ticket_lines (
    id,
    ticket_id,
    line_fingerprint,
    display_name,
    modifiers_text,
    quantity,
    sort_index,
    is_done,
    created_at
  )
`;

type TicketRow = Omit<PosKitchenTicket, "lines" | "status"> & {
  status: string;
  pos_kitchen_ticket_lines:
    | PosKitchenTicketLine[]
    | PosKitchenTicketLine
    | null;
};

function mapLines(
  raw: TicketRow["pos_kitchen_ticket_lines"],
): PosKitchenTicketLine[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return [...list]
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((line) => ({
      ...line,
      is_done: Boolean((line as { is_done?: boolean }).is_done),
    }));
}

export function mapPosKitchenTicketRow(row: unknown): PosKitchenTicket {
  const r = row as TicketRow;
  return {
    id: r.id,
    organization_id: r.organization_id,
    outlet_id: r.outlet_id,
    session_id: r.session_id,
    pos_table_id: r.pos_table_id,
    table_name: r.table_name,
    customer_name: r.customer_name ?? null,
    sales_type_id: r.sales_type_id ?? null,
    sales_type_label: r.sales_type_label ?? null,
    status: r.status as PosKitchenTicketStatus,
    is_held: Boolean(r.is_held),
    held_at: r.held_at ?? null,
    pause_ms: Number(r.pause_ms) || 0,
    restore_marker:
      r.restore_marker === "recalled" || r.restore_marker === "reverted"
        ? r.restore_marker
        : null,
    created_by: r.created_by,
    completed_at: r.completed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    lines: mapLines(r.pos_kitchen_ticket_lines),
  };
}
