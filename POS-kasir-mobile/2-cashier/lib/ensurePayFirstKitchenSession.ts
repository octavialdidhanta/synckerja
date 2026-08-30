import { supabase } from "@/shared/lib/supabaseClient";

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
};

/**
 * For pay-first checkout without an open bill: insert a paid walk-in/table session
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

  const { data, error } = await supabase
    .from("pos_table_sessions")
    .insert({
      organization_id: args.organizationId,
      outlet_id: args.outletId,
      group_id: args.posTableId ? args.groupId ?? null : null,
      pos_table_id: args.posTableId ?? null,
      table_name: tableName,
      pax: args.pax ?? 1,
      status: "paid",
      opened_by: user?.id ?? null,
      waiter_id: args.waiterId ?? user?.id ?? null,
      closed_at: now,
      closed_by: args.closedBy ?? user?.id ?? null,
      sales_activity_id: args.salesActivityId ?? null,
      cart_snapshot: [],
      customer_name: args.customerName?.trim() || null,
      customer_phone: args.customerPhone?.trim() || null,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("pay_first_session_insert_failed");
  return String(data.id);
}
