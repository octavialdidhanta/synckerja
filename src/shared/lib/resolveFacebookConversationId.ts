import { supabase } from '@/shared/lib/supabaseClient';

function derivedFacebookTicketId(conversationId: string): string {
  return `FB-${conversationId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/** Find facebook_conversations.id for a lead ticket (FB-xxxxxxxx). */
export async function resolveFacebookConversationIdByTicket(
  organizationId: string,
  ticketId: string,
): Promise<string | null> {
  const tid = ticketId.trim();
  if (!tid || !organizationId) return null;
  const tidUpper = tid.toUpperCase();
  if (!tidUpper.startsWith('FB-')) return null;

  const { data: byTicket, error: byTicketErr } = await supabase
    .from('facebook_conversations')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('ticket_id', tid)
    .maybeSingle();
  if (byTicketErr) throw byTicketErr;
  if (byTicket?.id) return String(byTicket.id);

  const { data: rows, error: rowsErr } = await supabase
    .from('facebook_conversations')
    .select('id')
    .eq('organization_id', organizationId);
  if (rowsErr) throw rowsErr;

  for (const row of rows ?? []) {
    const id = String(row.id);
    if (derivedFacebookTicketId(id) === tidUpper) return id;
  }

  return null;
}
