import { supabase } from '@/shared/lib/supabaseClient';

function derivedInstagramTicketId(conversationId: string): string {
  return `IG-${conversationId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/** Find instagram_conversations.id for a lead ticket (IG-xxxxxxxx), including legacy random ticket_id rows. */
export async function resolveInstagramConversationIdByTicket(
  organizationId: string,
  ticketId: string,
): Promise<string | null> {
  const tid = ticketId.trim();
  if (!tid || !organizationId) return null;
  const tidUpper = tid.toUpperCase();
  if (!tidUpper.startsWith('IG-')) return null;

  const { data: byTicket, error: byTicketErr } = await supabase
    .from('instagram_conversations')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('ticket_id', tid)
    .maybeSingle();
  if (byTicketErr) throw byTicketErr;
  if (byTicket?.id) return String(byTicket.id);

  const { data: rows, error: rowsErr } = await supabase
    .from('instagram_conversations')
    .select('id')
    .eq('organization_id', organizationId);
  if (rowsErr) throw rowsErr;

  for (const row of rows ?? []) {
    const id = String(row.id);
    if (derivedInstagramTicketId(id) === tidUpper) return id;
  }

  return null;
}
