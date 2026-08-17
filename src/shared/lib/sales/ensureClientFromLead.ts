import { supabase } from '@/shared/lib/supabaseClient';

export type EnsureClientFromLeadArgs = {
  organizationId: string;
  leadId: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
};

export type EnsuredVisitClient = {
  clientId: string;
  leadId: string;
};

type ClientLeadRow = {
  id: string;
};

async function findClientByLead(
  organizationId: string,
  leadId: string,
): Promise<ClientLeadRow | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('lead_id', leadId)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: String(data.id) } : null;
}

/** Reuse or create a clients stub so visits can keep lead_client_id NOT NULL. */
export async function ensureClientFromLead(
  args: EnsureClientFromLeadArgs,
): Promise<EnsuredVisitClient> {
  const leadId = args.leadId.trim();
  if (!leadId) throw new Error('Lead is required');

  const existing = await findClientByLead(args.organizationId, leadId);
  if (existing) {
    return { clientId: existing.id, leadId };
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, client, phone_number')
    .eq('id', leadId)
    .eq('organization_id', args.organizationId)
    .maybeSingle();
  if (leadError) throw leadError;
  if (!lead) throw new Error('Lead not found');

  const companyName = String(lead.client ?? '').trim() || 'Lead';
  const contactPerson = (args.contactPerson ?? companyName).trim() || companyName;
  const contactPhone =
    (args.contactPhone ?? (lead.phone_number as string | null) ?? '').trim() || null;

  const { data: inserted, error: insertError } = await supabase
    .from('clients')
    .insert({
      organization_id: args.organizationId,
      company_name: companyName,
      contact_person: contactPerson,
      contact_phone: contactPhone,
      lead_id: leadId,
      is_active: true,
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const raced = await findClientByLead(args.organizationId, leadId);
      if (raced) return { clientId: raced.id, leadId };
    }
    throw insertError;
  }

  return { clientId: String(inserted.id), leadId };
}
