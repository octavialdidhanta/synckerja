import { supabase } from "@/shared/lib/supabaseClient";

/** Sum of qty already sent to KDS per line fingerprint for a session (non-void tickets). */
export async function fetchKitchenFiredQtyByFingerprint(
  sessionId: string,
): Promise<Map<string, number>> {
  const { data: tickets, error: ticketsError } = await supabase
    .from("pos_kitchen_tickets")
    .select("id")
    .eq("session_id", sessionId)
    .neq("status", "void");

  if (ticketsError) throw ticketsError;
  const ticketIds = (tickets ?? []).map((t) => String((t as { id: string }).id));
  if (ticketIds.length === 0) return new Map();

  const { data: lines, error: linesError } = await supabase
    .from("pos_kitchen_ticket_lines")
    .select("line_fingerprint, quantity")
    .in("ticket_id", ticketIds);

  if (linesError) throw linesError;

  const byFp = new Map<string, number>();
  for (const row of lines ?? []) {
    const fp = String((row as { line_fingerprint: string }).line_fingerprint);
    const qty = Number((row as { quantity: number }).quantity) || 0;
    byFp.set(fp, (byFp.get(fp) ?? 0) + qty);
  }
  return byFp;
}

/** True when session has at least one non-void KDS ticket. */
export async function sessionHasKitchenTickets(sessionId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("pos_kitchen_tickets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .neq("status", "void");
  if (error) throw error;
  return (count ?? 0) > 0;
}
