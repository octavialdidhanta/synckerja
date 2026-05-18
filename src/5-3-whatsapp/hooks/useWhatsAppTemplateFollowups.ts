import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export type WhatsAppTemplateFollowupRow = {
  id: string;
  organization_id: string;
  whatsapp_conversation_id: string;
  template_name: string;
  template_language: string;
  customer_wa_id: string;
  ticket_id: string | null;
  send_status: 'sent' | 'failed';
  error_message: string | null;
  wa_message_id: string | null;
  sent_by: string;
  created_at: string;
  sender_name?: string | null;
};

export function useWhatsAppTemplateFollowups(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['whatsapp-template-followups', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<WhatsAppTemplateFollowupRow[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('whatsapp_template_followups')
        .select(
          'id, organization_id, whatsapp_conversation_id, template_name, template_language, customer_wa_id, ticket_id, send_status, error_message, wa_message_id, sent_by, created_at',
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as WhatsAppTemplateFollowupRow[];
      const userIds = [...new Set(rows.map((r) => r.sent_by).filter(Boolean))];
      if (userIds.length === 0) return rows;
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      const nameByUser = new Map(
        (profiles ?? []).map((p) => [p.user_id as string, (p.full_name as string | null) ?? null]),
      );
      return rows.map((r) => ({
        ...r,
        sender_name: nameByUser.get(r.sent_by) ?? null,
      }));
    },
    staleTime: 30_000,
  });
}
