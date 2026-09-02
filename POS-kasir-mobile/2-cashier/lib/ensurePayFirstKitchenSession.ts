import { supabase } from "@/shared/lib/supabaseClient";
import { planPayFirstSessionInsert } from "./pay-first-seating";

export type EnsurePayFirstKitchenSessionArgs = {
  organizationId: string;
  outletId: string;
  /** Existing open session — reuse without insert. */
  existingSessionId?: string | null;
  tableName: string;
  posTableId?: string | null;
  groupId?: string | null;
  pax?: number;
  waiterId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  salesActivityId?: string | null;
  closedBy?: string | null;
  /**
   * Dine-in pay-first: insert OPEN (cart empty, activity id set) so the
   * floor plan can occupy a table until Kosongkan meja.
   * Takeaway / default: insert paid + closed_at.
   */
  keepOpen?: boolean;
};

/**
 * For pay-first checkout without an open bill: insert a walk-in/table session
 * so KDS tickets can reference session_id (NOT NULL FK).
 */
export async function ensurePayFirstKitchenSession(
  args: EnsurePayFirstKitchenSessionArgs,
): Promise<string> {
  if (args.existingSessionId) return args.existingSessionId;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date().toISOString();
  const tableName = args.tableName.trim() || "Walk-in";
  const planned = planPayFirstSessionInsert({
    keepOpen: Boolean(args.keepOpen),
    nowIso: now,
    closedBy: args.closedBy ?? user?.id ?? null,
    pax: args.pax,
  });

  const { data, error } = await supabase
    .from("pos_table_sessions")
    .insert({
      organization_id: args.organizationId,
      outlet_id: args.outletId,
      group_id: args.posTableId ? args.groupId ?? null : null,
      pos_table_id: args.posTableId ?? null,
      table_name: tableName,
      pax: planned.pax,
      status: planned.status,
      opened_by: user?.id ?? null,
      waiter_id: args.waiterId ?? user?.id ?? null,
      closed_at: planned.closed_at,
      closed_by: planned.closed_by,
      sales_activity_id: args.salesActivityId ?? null,
      cart_snapshot: planned.cart_snapshot,
      customer_name: args.customerName?.trim() || null,
      customer_phone: args.customerPhone?.trim() || null,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("pay_first_session_insert_failed");
  return String(data.id);
}
