import { supabase } from '@/shared/lib/supabaseClient';

export type LeadConversionSalesActivityRow = {
  id: string;
  client_name: string | null;
};

/** Latest Lead Conversion sales activity for a lead (livechat / omnichannel). */
export async function resolveLeadConversionSalesActivity(
  organizationId: string,
  leadId: string,
): Promise<LeadConversionSalesActivityRow | null> {
  if (!organizationId || !leadId) return null;

  const { data, error } = await supabase
    .from('sales_activities')
    .select('id, client_name')
    .eq('organization_id', organizationId)
    .eq('lead_id', leadId)
    .eq('activity_type', 'Lead Conversion')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('resolveLeadConversionSalesActivity:', error);
    return null;
  }

  if (!data?.id) return null;
  return {
    id: data.id as string,
    client_name: (data.client_name as string | null) ?? null,
  };
}
